import R from 'ramda';
import loadDocument, { loadPlaysets, loadPage, pageNumbers } from './pdf.js';
import validatePlayset from './validate-playset.js';
import * as dom from './dom.js';
import renderAddPlayset from './views/add-playset.js';
import renderSetup from './views/setup.js';
import renderTable from './views/table.js';
import renderPlaysets from './views/playsets.js';
import renderPlayers from './views/players.js';
import renderPlaysetPreview from './views/playset-preview.js';
import renderHelp from './views/help.js';
import { shuffle, random, randomInteger, untilDifferent, parseInteger, capitalize, toArray, startsWith, contains } from 'utils';
import createQueue from './queue.js';
import * as storage from './storage.js';

dom.on(document, 'DOMContentLoaded', () => {
    function start() {
        const config = {
            maxPlayers: 5
        };
        const state = savedState() || emptyState();
        const current = {
            session: function() {
                if ( state.playset in state.sessions ) {
                    return state.sessions[state.playset];
                }
                else {
                    return emptySession();
                }
            },
            pairs: function() {
                return current.session().pairs;
            },
            playset: function() {
                return allPlaysets[state.playset];
            }
        };
        const c = current;
        
        let allPlaysets = {};
        let changedPlaysets = {};
        const deletedPlaysets = {};
        
        const Route = {
            table: /^(relationship|detail)\/(category|element)\/([1-5])$/
        };

        const nothing = function() {};

        dom.on(document, 'click', event => {
            const link = dom.closest(event.target, 'a');
            if ( link ) {
                const internal = dom.origin(link) === location.origin;
                const opensInNewWindow = link.hasAttribute('target');
                if ( internal && !opensInNewWindow ) {
                    event.preventDefault();
                    history.pushState(null, '', link.href);
                    showCurrentPage();
                }
            }
        });

        dom.on(window, 'popstate', showCurrentPage);
        dom.on(window, 'beforeunload', handleExit);

        dom.on(document, 'keydown', event => {
            if ( dom.key(event) === 'escape' ) {
                if ( state.page === 'table' ) {
                    views.table.close();
                }
                else if ( state.page === 'help' ) {
                    history.back();
                }
            }
        });

        function currentPath() {
            return location.pathname.split('/').slice(1).map(decodeURIComponent);
        }

        function showCurrentPage() {
            const path = currentPath();
            const page = route(path);
            const handle = handlers[page] || handlers['playsets'];
            
            const dataset = document.documentElement.dataset;
            dataset.help = page === 'help' ? 'true' : 'false';
            
            handle(path);
            // Check for Piwik first, because it may not have loaded yet
            // (especially for the first page).
            if ( Piwik ) {
                Piwik.getAsyncTracker().trackPageView(document.title);
            }
        }

        function showPage(name, title, literalTitle) {
            state.page = name;
            const pages = dom.all('main > .page');
            pages.forEach(page => {
                page.hidden = page.id !== name;
            });
            
            const activePage = pages.filter(p => p.id === name)[0];
            if ( title !== undefined && literalTitle === true ) {
                document.title = title;
            }
            else if ( title === undefined && 'title' in activePage.dataset ) {
                document.title = activePage.dataset.title + ' | Fiascomputer';
            }
            else if ( title !== undefined ) {
                document.title = title + ' | Fiascomputer';
            }
            else {
                document.title = 'Fiascomputer';
            }
            
            return activePage;
        }

        function go(path) {
            history.pushState(null, '', path);
            showCurrentPage();
        }
        
        function redirect(path) {
            history.replaceState(null, '', path);
            showCurrentPage();
        }

        function route(path) {
            if ( path[0] === 'relationship' || path[0] === 'detail' ) {
                return 'table';
            }
            else if ( path[0] === 'playsets' && path.length === 2 ) {
                return 'playset-preview';
            }
            else {
                return path[0];
            }
        }

        const handlers = {
            'intro': path => showPage('intro', 'Fiascomputer | Create and visualize Fiasco setups', true),
            'playsets': path => {
                if ( 'launched' in localStorage ) {
                    showPage('playsets', 'Playsets')
                }
                else {
                    redirect('/intro')
                }
            },
            'players': path => {
                showPage('players', 'Number of players');
            },
            'add-playset': path => showPage('add-playset'),
            'playset-preview': path => {
                const page = dom.id('playset-preview');
                const id = path[1];
                const playset = allPlaysets[id];
                if ( playset ) {
                    views.playsetPreview(
                        playset,
                        page,
                        sessionInProgress(playset.id),
                        () => loadPlaysetPage(playset.pages[0]),
                        () => {
                            // We should centralize the logic for determining the type
                            // of a playset page. The parser logic currently requires a
                            // reference to the PDF object, which is why cannot use that
                            // logic here.
                            if ( playset.pages.length > 2 ) {
                                return loadPlaysetPage(playset.pages[2]);
                            } else {
                                return Promise.reject('No score page for playset: ' + playset.title);
                            }
                        },
                        () => {
                            if ( playset.pages.length > 2 ) {
                                return loadPlaysetPage(playset.pages[1]);
                            } else {
                                return Promise.reject('No credits page for playset: ' + playset.title);
                            }
                        }
                    );
                    showPage('playset-preview', playset.title);
                }
                else {
                    go('/playsets');
                }
            },
            'setup': path => {
                if ( c.playset() ) {
                    views.setup.renderSetup(
                        c.playset(),
                        c.pairs().map(showPair),
                        c.session().players.names,
                        c.session().players.count
                    );
                    showPage('setup', 'Setup');
                }
                else {
                    go('playsets');
                }
            },
            'table': path => {
                const type = path[0];
                const level = path[1];
                const pair = parseInteger(path[2]) - 1;
                const table = c.pairs()[pair][type].table;
                const category = level === 'element' ? c.pairs()[pair][type].category : null;

                views.table.renderTable({
                    title: table,
                    subtitle: c.playset().subtitle,
                    categories: c.playset().tables[table].categories,
                    elements: c.playset().tables[table].elements
                }, category);
                showPage('table', capitalize(table));
            },
            'help': path => showPage('help')
        };

        const listeners = {};
        function listen(event, key, callback) {
            listeners[event] = listeners[event] || {};
            listeners[event][key] = listeners[event][key] || [];
            listeners[event][key].push(callback);
        }

        function signal(event, key, value) {
            if ( event === 'change' && key === 'playset' ) {
                console.log('playset changed ' + value.id);
                changedPlaysets[value.id] = true;
                R.mapObjIndexed(signal =>
                    signal.playsetChanged
                        ? signal.playsetChanged(value, value.id in deletedPlaysets, loadPlaysetPage)
                        : null,
                    views
                );
            }
            else if ( event === 'change' && key === 'players' ) {
                document.body.className = 'players-' + value;
                c.session().players.count = value;
            }

            if ( event in listeners && key in listeners[event] ) {
                listeners[event][key].forEach(callback => callback(value));
            }
        }
        
        signal('change', 'players', c.session().players.count);

        const views = {
            setup: renderSetup(c.session().players.names, config.maxPlayers, c.session().players.count, dom.id('setup'), {
                randomizeSetup: () => {
                    randomizeSetup(c.session().players.count);
                    views.setup.renderSetup(
                        c.playset(),
                        c.pairs().map(showPair),
                        c.session().players.names,
                        c.session().players.count
                    );
                },
                randomizeRelationshipCategory: (pair) => {
                    randomizeCategory(pair, 'relationships');
                    views.setup.renderRelationship(pair, showPairItem(c.pairs()[pair], 'relationship'));
                },
                randomizeRelationshipElement: (pair) => {
                    randomizeElement(pair, 'relationships');
                    views.setup.renderRelationship(pair, showPairItem(c.pairs()[pair], 'relationship'));
                },
                randomizeDetailCategory: (pair) => {
                    randomizeCategory(pair, c.pairs()[pair].detail.table);
                    views.setup.renderDetail(pair, showPairItem(c.pairs()[pair], 'detail'));
                },
                randomizeDetailElement: (pair) => {
                    randomizeElement(pair, c.pairs()[pair].detail.table);
                    views.setup.renderDetail(pair, showPairItem(c.pairs()[pair], 'detail'));
                },
                removeRelationshipCategory: (pair) => {
                    const relationship = c.pairs()[pair].relationship;
                    relationship.category = null;
                    relationship.element = null;
                    views.setup.renderRelationship(pair, showPairItem(c.pairs()[pair], 'relationship'));
                },
                removeRelationshipElement: (pair) => {
                    const relationship = c.pairs()[pair].relationship;
                    relationship.element = null;
                    views.setup.renderRelationship(pair, showPairItem(c.pairs()[pair], 'relationship'));
                },
                removeDetailCategory: (pair) => {
                    const detail = c.pairs()[pair].detail;
                    detail.category = null;
                    detail.element = null;
                    views.setup.renderDetail(pair, showPairItem(c.pairs()[pair], 'detail'));
                },
                removeDetailElement: (pair) => {
                    const detail = c.pairs()[pair].detail;
                    detail.element = null;
                    views.setup.renderDetail(pair, showPairItem(c.pairs()[pair], 'detail'));
                },
                changeDetailType: (pair, type) => {
                    const detail = c.pairs()[pair].detail;
                    detail.table = type === null ? null : type + 's';
                    views.setup.renderDetail(pair, showPairItem(c.pairs()[pair], 'detail'));
                },
                changeTitle: title => {
                    c.playset().title = title;
                    signal('change', 'playset', c.playset());
                },
                changePlayerName: (index, name) => {
                    c.session().players.names[index] = name;
                },
                changePlayerCount: count => {
                    signal('change', 'players', count);
                }
            }),
            table: renderTable(dom.id('table'), {
                selectCategory: category => {
                    const path = location.pathname.substring(1);
                    const matches = path.match(Route.table);
                    const type = matches[1];
                    const pair = parseInteger(matches[3]) - 1;

                    const item = c.pairs()[pair][type];
                    if ( category !== item.category ) {
                        item.element = null;
                    }
                    item.category = category;

                    const renderMethod = 'render' + capitalize(type);
                    views.setup[renderMethod](pair, showPairItem(c.pairs()[pair], type));
                },
                selectElement: (category, element) => {
                    const path = location.pathname.substring(1);
                    const matches = path.match(Route.table);
                    const type = matches[1];
                    const pair = parseInteger(matches[3]) - 1;

                    const item = c.pairs()[pair][type];
                    item.category = category;
                    item.element = element;

                    const renderMethod = 'render' + capitalize(type);
                    views.setup[renderMethod](pair, showPairItem(c.pairs()[pair], type));
                },
                changeCategory: (category, text) => {
                    const path = location.pathname.substring(1);
                    const matches = path.match(Route.table);
                    const type = matches[1];
                    const pair = parseInteger(matches[3]) - 1;
                    const table = c.pairs()[pair][type].table;

                    c.playset().tables[table].categories[category] = text;
                    signal('change', 'playset', c.playset());
                },
                changeElement: (category, element, text) => {
                    const path = location.pathname.substring(1);
                    const matches = path.match(Route.table);
                    const type = matches[1];
                    const pair = parseInteger(matches[3]) - 1;
                    const table = c.pairs()[pair][type].table;

                    c.playset().tables[table].elements[category][element] = text;
                    signal('change', 'playset', c.playset());
                },
                changeSubtitle: subtitle => {
                    const path = location.pathname.substring(1);
                    const matches = path.match(Route.table);
                    const type = matches[1];
                    const pair = parseInteger(matches[3]) - 1;
                    const table = c.pairs()[pair][type].table;
                    
                    c.playset().subtitle = subtitle;
                    signal('change', 'playset', c.playset());
                }
            }),
            playsetPreview: renderPlaysetPreview(dom.id('playset-preview'), {
                startSetup: () => {
                    state.playset = currentPath()[1];
                    signal('change', 'players', c.session().players.count);
                },
                resumeSetup: () => {
                    state.playset = currentPath()[1];
                    signal('change', 'players', c.session().players.count);
                },
                deletePlayset: () => {
                    const id = currentPath()[1];
                    const playset = allPlaysets[id];
                    deletedPlaysets[id] = true;
                    deletePlayset(playset);
                    signal('change', 'playset', playset);
                },
                changeTitle: title => {
                    const id = currentPath()[1];
                    const playset = allPlaysets[id];
                    playset.title = title;
                    signal('change', 'playset', playset);
                }
            }),
            players: renderPlayers(dom.id('players'), {
                changePlayerCount: count => {
                    signal('change', 'players', count);
                }
            }),
            help: renderHelp(dom.id('help'))
        };

        views.playsets = renderPlaysets(dom.id('playsets'), {
            selectPlayset: id => {
                if ( id in deletedPlaysets ) {
                    const playset = allPlaysets[id];
                    delete deletedPlaysets[id];
                    savePlayset(playset);
                    signal('change', 'playset', playset);
                }
            }
        });

        views.addPlayset = renderAddPlayset(dom.id('add-playset'), {
            addPlaysetFiles: files => {
                files.forEach(addPlaysetFile);
                go('/playsets');
                views.playsets.focus();
            }
        });

        const queuePlaysetFile = createQueue(1);
        const addPlaysetFile = file => {
            views.playsets.playsetLoadStarted();
            return queuePlaysetFile(() => loadDocument(file).then(pdf => {
                return loadPlaysetPagesFromPdf(pdf, file.name)
                .then(() => pdf.destroy());
            }))
            .catch(error => views.playsets.playsetLoadFailed(file.name));
        };

        const loadPlaysetPagesFromPdf = (pdf, filename) => {
            return loadPlaysets(pdf)
            .then(playsets => {
                // We put this early because we cannot run the validation after the
                // playsets have been been converted to lists.
                if ( playsets.some(p => validatePlayset(p).length > 0) ) {
                    alert(
                        'We were able to load the playset in the file "' +
                        filename + '", but there were some parts that ' +
                        'we did not understand. If you find any errors, ' +
                        'you can edit the playset to fix them.'
                    );
                }
                
                return playsets.map(playsetToLists);
            })
            .then(playsets => {
                // Single file turned out to contain more than one playset, so
                // compensate for "missing" messages to view.
                R.range(0, playsets.length - 1).forEach(views.playsets.playsetLoadStarted);
                return Promise.all(playsets.map((playset, index) => {
                    playset.id = uniqueIdentifier(simplifyString(playset.title), Object.keys(allPlaysets));
                    
                    const numbers = pageNumbers(pdf)[index];
                    const queuePage = createQueue(1);
                    return queuePage(() => loadPage(pdf, numbers.cover, 0.5, 'image/jpeg'))
                    .then(thumbnail => {
                        return Promise.all(
                            [numbers.cover, numbers.title, numbers.score]
                            .map(num => {
                                if ( num ) {
                                    return queuePage(() => loadPage(
                                        pdf, num, 2,
                                        num === numbers.cover ? 'image/jpeg' : 'image/png'
                                    ));
                                }
                                else {
                                    return Promise.resolve(null);
                                }
                            })
                        ).then(pages => {
                            playset.pages = pages.filter(p => p).map((page, i) => {
                                const key = playset.id + '/' + i;
                                storage.write(db, 'pages', key, page).catch(console.error);
                                return key;
                            });
                            storage.write(db, 'thumbnails', playset.pages[0], thumbnail).catch(console.error);
                            addPlayset(playset);
                            savePlayset(playset);
                            
                            return playset;
                        });
                    });
                }));
            });
        };
        
        function addPlayset(playset) {
            allPlaysets[playset.id] = playset;
            if ( !(playset.id in state.sessions) ) {
                state.sessions[playset.id] = emptySession();
            }
            views.playsets.playsetAdded(playset, playset.id in deletedPlaysets, loadPlaysetPageThumbnail);
            return playset;
        }
        
        function simplifyString(str) {
            return (
                str
                .toLowerCase()
                .trim()
                .replace(/\s+/g, ' ')
                .replace(/ /g, '-')
                .replace(/[^a-z0-9-]/g, '')
            );
        }

        function uniqueIdentifier(str, keys) {
            let id = str;
            for ( let number = 2; keys.indexOf(id) !== -1; number += 1 ) {
                id = str + '-' + number;
            }
            return id;
        }

        let db = null;
        storage.open('fiascomputer', db => {
            db.createObjectStore('playsets');
            db.createObjectStore('pages');
            db.createObjectStore('thumbnails');
        }).then(result => {
            db = result;
            
            const loadPlaysets = 'launched' in localStorage
                ? loadSavedPlaysets
                : loadBundledPlaysets;
            loadPlaysets().then(playsets => {
                Object.keys(playsets)
                .sort((a, b) => playsets[a].title.localeCompare(playsets[b].title))
                .forEach(id => {
                    views.playsets.playsetLoadStarted();
                    addPlayset(playsets[id]);
                });
                allPlaysets = playsets;
                document.documentElement.classList.remove('loading');
                showCurrentPage();
                localStorage.launched = true;
            })
            .catch(error => alert(error.stack));
        })
        .catch(error => alert(error.stack));

        function savePlayset(playset) {
            return storage.write(db, 'playsets', playset.id, playset);
        }
        
        function deletePlayset(playset) {
            return storage.remove(db, 'playsets', playset.id).catch(console.error);
        }

        function loadSavedPlaysets() {
            return storage.read(db, 'playsets').catch(console.error);
        }
        
        function loadBundledPlaysets() {
            const ids = [
                'ak02_heroes_of_pinnacle_city',
                'br01_de_medici',
                'bt01_jersey_side',
                'cb02_dallas_1963',
                'cb03_havana_1953',
                'cn01_news_channel_six',
                'db01_tartan_noir',
                'dp01_manna_hotel',
                'dp02_the_penthouse',
                'el01_transatlantic',
                'gs01_hk_tpk',
                'gw01_gangster_london',
                'jb01_hollywood_wives',
                'jc01_horse_fever',
                'jg01_camp_death',
                'jl01_objective_zebra',
                'jm05_touring_rock_band',
                'jm06_last_frontier',
                'jm07_lucky_strike',
                'jm08_flyover',
                'jm09_1913_new_york',
                'jm12_home_invasion',
                'jw01_golden_panda',
                'lb01_dragon_slayers',
                'lb02_dc73',
                'lb03_salem_1692',
                'mc01_red_front',
                'mp01_break_a_leg',
                'rc01_white_hole',
                'sb01_back_to_the_old_house',
                'sg01_town_and_gown',
                'tg01_reconstruction',
                'trb02_touring_rock_band_2',
                'wh01_london_1593',
                'wh02_the_zoo',
                'wh03_flight_1180'
            ];
            const table = {};
            return Promise.all(ids.map(id => {
                return request('GET', '/bundled/' + id + '.json', { type: 'json' })
                .then(playset => {
                    playset = playsetToLists(playset);
                    playset.id = id;
                    playset.pages = [
                        '/bundled/' + id + '-cover.jpg',
                        '/bundled/' + id + '-credits.png',
                        '/bundled/' + id + '-score.png'
                    ];
                    table[id] = playset;
                });
            }))
            .then(() => {
                // Make sure they will be saved.
                ids.forEach(id => {
                    changedPlaysets[id] = true;
                });
                return table;
            });
        }
        
        function request(method, url, options) {
            return new Promise((resolve, reject) => {
                var req = new XMLHttpRequest();
                req.open(method, url);
                req.addEventListener('load', event => resolve(req.response));
                req.addEventListener('error', event => reject(req));
                req.addEventListener('abort', event => reject(req));
                req.responseType = options.type;
                req.send();
            });
        }
        
        function loadPlaysetPage(key) {
            if ( startsWith(key, '/') ) {
                return Promise.resolve(key);
            }
            else {
                return loadSavedPlaysetPage(key);
            }
        }
        
        function loadPlaysetPageThumbnail(key) {
            if ( startsWith(key, '/') ) {
                const url = key.replace(/\.(jpg|png)$/, '.small.$1');
                return Promise.resolve(url);
            }
            else {
                return loadSavedPlaysetPageThumbnail(key);
            }
        }
        
        const loadSavedPlaysetPage = R.memoize(function(key) {
            return storage.read(db, 'pages', key);
        });
        
        const loadSavedPlaysetPageThumbnail = R.memoize(function(key) {
            return storage.read(db, 'thumbnails', key);
        });

        function playsetToLists(playset) {
            playset.tables = R.mapObj(table => {
                return {
                    subtitle: table.subtitle,
                    categories: table.categories.map(c => c.name),
                    elements: table.categories.map(c => c.elements.slice())
                };
            }, playset.tables);
            return playset;
        }

        dom.on(dom.id('menu-button'), 'click', () => {
            const dataset = document.documentElement.dataset;
            dataset.menu = dataset.menu === 'false' ? 'true' : 'false';
        });

        dom.on(dom.id('help-button'), 'click', event => {
            const dataset = document.documentElement.dataset;
            if ( dataset.help === 'true' ) {
                event.preventDefault();
                dataset.help = 'false';
                history.back();
            }
            else {
                dataset.help = 'true';
            }
        });

        dom.on(document, 'click', event => {
            const menuButtonWasClicked = event.target === dom.id('menu-button');
            if ( !menuButtonWasClicked ) {
                const elementOutsideMenuWasClicked = !dom.id('menu').contains(event.target);
                const controlInsideMenuWasClicked =
                    !elementOutsideMenuWasClicked && (
                        event.target.tagName === 'A' || event.target.tagName === 'BUTTON'
                    );
                if ( elementOutsideMenuWasClicked || controlInsideMenuWasClicked ) {
                    document.documentElement.dataset.menu = 'false';
                }
            }
        });
        
        dom.on(dom.id('menu'), 'change', event => {
            document.documentElement.dataset.menu = 'false';
        });
        
        ['webkitfullscreenchange', 'mozfullscreenchange', 'fullscreenchange'].forEach(e => {
            dom.on(document, e, event => {
                document.documentElement.classList.toggle(
                    'fullscreen',
                    document.webkitFullscreenElement ||
                    document.mozFullscreenElement ||
                    document.fullscreenElement
                );
            });
        });
        
        dom.on(dom.id('enter-fullscreen-control'), 'click', event => {
            [
                'webkitRequestFullscreen',
                'webkitRequestFullScreen',
                'mozRequestFullscreen',
                'mozRequestFullScreen',
                'requestFullscreen'
            ].forEach(f => {
                if ( f in document.documentElement ) {
                    document.documentElement[f]();
                }
            });
        });
        
        dom.on(dom.id('leave-fullscreen-control'), 'click', event => {
            [
                'webkitExitFullscreen',
                'webkitExitFullScreen',
                'mozExitFullscreen',
                'mozExitFullScreen',
                'mozCancelFullScreen',
                'mozCancelFullscreen',
                'exitFullscreen'
            ].forEach(f => {
                if ( f in document ) {
                    document[f]();
                }
            });
        });

        const themeControl = dom.id('theme-control');
        dom.select(themeControl, event => {
            selectTheme(themeControl.value);
        }, state.theme);

        function selectTheme(name) {
            state.theme = name;
            const stylesheets = dom.all('link[rel~=stylesheet]', document.head);
            stylesheets.forEach(link => link.disabled = true);
            stylesheets.filter(link => contains(link.href, name))[0].disabled = false;
        }

        function showPair(pair) {
            return {
                relationship: showPairItem(pair, 'relationship'),
                detail: showPairItem(pair, 'detail')
            };
        }

        function showPairItem(pair, type) {
            const item = pair[type];
            return showItem(c.playset(), item.table, item.category, item.element);
        }

        function showItem(playset, table, category, element) {
            return {
                table: table,
                category: showCategory(playset, table, category),
                element: showElement(playset, table, category, element)
            };
        }

        function showCategory(playset, table, category) {
            return table === null || category === null ? null :  {
                name: playset.tables[table].categories[category],
                die: category + 1
            };
        }

        function showElement(playset, table, category, element) {
            return table === null || element === null ? null : {
                name: playset.tables[table].elements[category][element],
                die: element + 1
            };
        }

        function randomizeSetup(playerCount) {
            randomizeDetailTypes(playerCount);
            c.pairs().forEach((pair, index) => {
                randomizeItem(index, 'relationships');
                randomizeItem(index, c.pairs()[index].detail.table);
            });
        }

        // This function randomizes detail types for all pairs (five), even when
        // only three or four are active, but uses the current number of players to
        // ensure a good selection of types.
        function randomizeDetailTypes(playerCount) {
            // First decide which types will be present, using the suggestions
            // defined in the Fiasco book. In other words: at least one of each
            // type, then an additional need, then an additional location or object.
            const types = [
                'needs',
                'locations',
                'objects',
                'needs',
                random(['locations', 'objects'])
            ];

            // Randomly place the types in the setup, based on the current number of
            // players. We need to make sure that the setup gets the detail types
            // suggested for its number of players, so we place them in the order
            // used above.
            const order = shuffle(R.range(0, playerCount));
            order.forEach((pairIndex, typeIndex) => {
                c.pairs()[pairIndex].detail.table = types[typeIndex];
            });

            // Place the remaining types in the default order, because we want to
            // make sure that they are present if the number of players is
            // increased.
            R.range(playerCount, config.maxPlayers).forEach(index => {
                c.pairs()[index].detail.table = types[index];
            });
        }

        function randomizeItem(pair, table) {
            const property = table === 'relationships' ? 'relationship' : 'detail';
            const item = c.pairs()[pair][property];
            item.category = rollDie();
            item.element = rollDie();
        }

        function randomizeCategory(index, table) {
            const property = table === 'relationships' ? 'relationship' : 'detail';
            const item = c.pairs()[index][property];
            item.category = untilDifferent(item.category, rollDie);
            item.element = null;
        }

        function randomizeElement(index, table) {
            const property = table === 'relationships' ? 'relationship' : 'detail';
            const item = c.pairs()[index][property];
            if ( item.category === null ) {
                randomizeCategory(index, table);
            }

            item.element = untilDifferent(item.element, rollDie);
        }

        function rollDie() {
            return randomInteger(5);
        }
        
        function sessionInProgress(id) {
            return Boolean(state.sessions[id].players.count);
        }
        
        function emptyState() {
            return {
                sessions: {},
                playset: null
            };
        }
        
        function emptySession() {
            return {
                players: {
                    count: null,
                    names: ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5']
                },
                pairs: R.range(0, config.maxPlayers).map(index => { return {
                    relationship: {
                        table: 'relationships',
                        category: null,
                        element: null
                    },
                    detail: {
                        table: null,
                        category: null,
                        element: null
                    }
                }})
            };
        }

        function saveState() {
            localStorage.state = JSON.stringify(state);
        }

        function savedState() {
            try {
                const state = JSON.parse(localStorage.state);
                return state || null;
            }
            catch(error) {
                return null;
            }
        }
        
        function savePlaysets() {
            const playsets = R.difference(
                Object.keys(changedPlaysets),
                Object.keys(deletedPlaysets)
            );
            
            if ( playsets.length === 0 ) {
                return false;
            }
            
            console.log('Saving playsets...');
            return Promise.all(playsets
            .map(id => {
                console.log('Saving playset "' + id + '"...');
                return savePlayset(allPlaysets[id])
                .then(() => console.log('Finished saving playset "' + id + '"'));
            }))
            .then(() => {
                console.log('Finished saving playsets');
                after();
            })
            .catch(() => {
                console.error('Failed saving playsets');
                after();
            });
            
            function after() {
                changedPlaysets = {};
            }
        }
        
        setInterval(saveEverything, 20 * 1000);
        
        function saveEverything() {
            saveState();
            savePlaysets();
        }
        
        function handleExit(event) {
            saveState();
            if ( savePlaysets() ) {
                return event.returnValue = 'Your playsets are currently being saved.';
            }
        }
    }
    
    try {
        start();
    }
    catch(error) {
        alert(error.stack);
    }
});
