import R from 'ramda';
import loadDocument, { loadPlaysets, loadPage, pageNumbers } from './pdf.js';
import validatePlayset from './validate-playset.js';
import * as dom from './dom.js';
import renderAddPlayset from './views/add-playset.js';
import renderCommon from './views/common.js';
import joinPage from './pages/join.js';
import tablePage from './pages/table.js';
import setupPage from './pages/setup.js';
import renderPlaysets from './views/playsets.js';
import renderPlayers from './views/players.js';
import renderPlaysetPreview from './views/playset-preview.js';
import renderHelp from './views/help.js';
import renderVersion from './views/version.js';
import { parseInteger, capitalize, startsWith, withParams } from 'utils';
import createQueue from './queue.js';
import * as storage from './storage.js';
import * as State from './state.js';
import * as Navigation from './navigation.js';
import * as Setup from './setup.js';
import { load as loadCollab, auth as authCollab, host as hostSession } from './collaboration.js';

dom.on(document, 'DOMContentLoaded', () => {
    function start() {
        const config = {
            version: '1.1',
            maxPlayers: 5
        };
        const state = State.read();
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
        
        let collaborate = R.identity;
        // Try to authenticate with Google Drive without a popup, then register
        // whether it was successful or not, for later use.
        let authSuccess = false;
        loadCollabOnce().then(() => authCollab()).then(() => authSuccess = true);
        
        let allPlaysets = {};
        let changedPlaysets = {};
        const deletedPlaysets = {};
        
        const routes = {
            depth: 0,
            routes: routesWithSession([
                { intro: ['intro'] },
                { help: ['help'] },
                { addPlayset: ['add-playset'] },
                { playsets: [] },
                { playsets: ['playsets'] },
                { playset: ['playsets', {id:String}] },
                { players: [/*'playsets', {id:String},*/ 'players'] },
                { setup: [/*'playsets', {id:String},*/ 'setup'] },
                { table: [
                    // 'playsets',
                    // {id:String},
                    {type:['relationship', 'detail']},
                    {subtype:['category', 'element']},
                    {pair: s => Number(s) - 1} // Zero-indexed pairs
                ] },
                { version: ['version', {id:String}] }
            ]),
            default: 'playsets'
        };
        
        // Add a session query parameter to each route, because practically every
        // page needs to know which session is active.
        function routesWithSession(routes) {
            return routes.map(r1 => {
                const r2 = {};
                const name = Object.keys(r1)[0];
                r2[name] = { path: r1[name], query: ['session'] };
                return r2;
            });
        }
        
        function connectToSession(id) {
            const initial = {
                pairs: c.pairs(),
                players: c.session().players.names,
                // We may not have set a player count yet (which is what
                // use to track which setups have been started), but we
                // must not set the collaborative property to null so
                // thus pass in `maxPlayers` as a default.
                activePlayers: c.session().players.count || config.maxPlayers,
                playset: c.playset()
            };
            // If we weren't succesful in authenticating earlier without a
            // popup, use a popup now, otherwise simply reauthenticate without
            // one.
            return loadCollabOnce().then(() => authCollab(!authSuccess)).then(() => {
                return hostSession(id, initial, {
                    change: change,
                    playerJoined: pages.common.playerJoined,
                    playerLeft: pages.common.playerLeft
                });
            })
            .then(result => {
                collaborate = result.change;
                const url = location.origin + '/join?session=' + encodeURIComponent(result.id);
                pages.players.sessionReady(url);
                return result;
            });
        }
        
        let currentRequest = {};
        const root = '/';
        const nav = dom.activateNavigation(location => {
            try {
                currentRequest = Navigation.handle(location, routes, handlers).params;
            }
            catch(error) {
                console.error(error);
                nav.redirect(root);
            }
        });

        let currentPage = null;
        function showPage(name, title, literalTitle) {
            currentPage = name;
            dom.showPage(name, title, literalTitle);
        }

        dom.on(window, 'beforeunload', handleExit);

        dom.on(document, 'keydown', event => {
            if ( dom.key(event) === 'escape' ) {
                if ( currentPage === 'table' ) {
                    pages.table.close();
                }
                else if ( currentPage === 'help' ) {
                    history.back();
                }
            }
        });

        const handlers = checkForNewVersion(checkForSession({
            intro: request => showPage('intro', 'Fiascomputer | Create and visualize Fiasco setups', true),
            playsets: request => {
                if ( 'launched' in localStorage ) {
                    showPage('playsets', 'Playsets')
                }
                else {
                    nav.redirect('/intro')
                }
            },
            players: request => {
                showPage('players', 'Number of players');
            },
            addPlayset: request => showPage('add-playset'),
            playset: request => {
                const page = dom.id('playset-preview');
                const id = request.id;
                const playset = allPlaysets[id];
                if ( playset ) {
                    pages.playsetPreview(
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
                    nav.go('/playsets');
                }
            },
            setup: request => {
                if ( c.playset() ) {
                    c.pairs().forEach((p, i) => {
                        pages.setup.relationshipChanged(i, Setup.showItem(c.playset(), p.relationship));
                        pages.setup.detailChanged(i, Setup.showItem(c.playset(), p.detail));
                    });
                    pages.setup.titleChanged(c.playset().title);
                    pages.setup.playerCountChanged(c.session().players.count);
                    c.session().players.names.forEach((n, i) => pages.setup.playerNameChanged(i, n));
                    showPage('setup', 'Setup');
                }
                else {
                    nav.go('playsets');
                }
            },
            table: request => {
                const type = request.type;
                const level = request.subtype;
                const pair = request.pair;
                const table = c.pairs()[pair][type].table;
                const category = level === 'element' ? c.pairs()[pair][type].category : null;

                pages.table.changed({
                    title: table,
                    subtitle: c.playset().subtitle,
                    categories: c.playset().tables[table].categories,
                    elements: c.playset().tables[table].elements
                }, category);
                showPage('table', capitalize(table));
            },
            help: request => showPage('help'),
            version: request => {
                pages.version.versionChanged(request.id);
                showPage('version');
            }
        }));
        
        function checkForSession(callbacks) {
            return R.mapObjIndexed(handler => {
                return function(request) {
                    if ( 'session' in request && collaborate === R.identity ) {
                        dom.showPage('join');
                        pages.join.loading();
                        loadCollabOnce()
                        .then(() => authCollab())
                        .then(() => {
                            pages.join.loading();
                            connectToSession(request.session)
                            .then(() => handler(request))
                            .catch(error => {
                                pages.join.failed(error);
                            })
                        })
                        .catch(() => {
                            loadCollabOnce().then(pages.join.login());
                        });
                    }
                    else {
                        handler(request);
                    }
                };
            }, callbacks);
        }
        
        function checkForNewVersion(callbacks) {
            let checked = localStorage.version === config.version;
            return R.mapObjIndexed(handler => {
                return function(request) {
                    if ( checked ) {
                        handler(request);
                    }
                    else {
                        checked = true;
                        localStorage.version = config.version;
                        nav.go('/version/' + config.version, undefined, {force: true});
                    }
                };
            }, callbacks);
        }

        function change() {
            const args = [].slice.call(arguments);
            const type = args[0];
            if ( type === 'playset' ) {
                const playset = args[1];
                changedPlaysets[playset.id] = true;
                R.mapObjIndexed(
                    signal => signal.playsetChanged
                        ? signal.playsetChanged(playset, playset.id in deletedPlaysets, loadPlaysetPage)
                        : null,
                    pages
                );
                collaborate('title', playset.title);
                collaborate('subtitle', playset.title);
                R.mapObjIndexed((table, tableName) => {
                    table.categories.forEach((text, index) => {
                        collaborate('category', tableName, index, text);
                    });
                }, playset.tables);
                R.mapObjIndexed((table, tableName) => {
                    table.elements.forEach((es, c) => {
                        es.forEach((text, index) => {
                            collaborate('element', tableName, c, index, text);
                        });
                    });
                }, playset.tables);
                c.pairs().forEach((p, i) => change('pair', i, p));
            }
            else if ( type === 'pair' ) {
                const index = args[1];
                const pair = args[2];
                change('relationship', index, pair.relationship);
                change('detail', index, pair.detail);
            }
            else if ( type === 'relationship' || type === 'detail' ) {
                const i = args[1];
                const item = args[2];
                c.pairs()[i][type] = item;
                const changeMethod = type + 'Changed';
                pages.setup[changeMethod](i, Setup.showItem(c.playset(), item));
                collaborate(type, i, item);
            }
            else if ( type === 'category' ) {
                const table = args[1];
                const category = args[2];
                const text = args[3];
                c.playset().tables[table].categories[category] = text;
                change('playset', c.playset());
                collaborate('category', table, category, text);
            }
            else if ( type === 'element' ) {
                const table = args[1];
                const category = args[2];
                const element = args[3];
                const text = args[4];
                c.playset().tables[table].elements[category][element] = text;
                change('playset', c.playset());
                collaborate('element', table, category, element, text);
            }
            else if ( type === 'player' ) {
                const i = args[1];
                const name = args[2];
                pages.setup.playerNameChanged(i, name);
                c.session().players.names[i] = name;
                collaborate('player', i, name);
            }
            else if ( type === 'activePlayers' ) {
                const count = args[1];
                R.range(0, config.maxPlayers).forEach(i => {
                    const n = i + 1;
                    document.documentElement.classList.toggle('players-' + n, n === count);
                });
                // The player dropdown causes an event before the view has even
                // returned, so we need to check for the page first.
                if (pages) pages.setup.playerCountChanged(count);
                c.session().players.count = count;
                collaborate('activePlayers', count);
            }
            else if ( type === 'title' ) {
                const title = args[1];
                pages.setup.titleChanged(title);
                c.playset().title = title;
                change('playset', c.playset());
                collaborate('title', title);
            }
            else if ( type === 'subtitle' ) {
                const subtitle = args[1];
                c.playset().subtitle = subtitle;
                change('playset', c.playset());
                collaborate('subtitle', subtitle);
            }
            else {
                console.log('Unhandled change type: ' + type);
            }
        }
        
        change('activePlayers', c.session().players.count);

        function readState() {
            return {
                players: c.session().players,
                pairs: c.pairs()
            };
        }
        
        const pages = {
            join: joinPage(dom.id('join'), {
                login: () => {
                    // After login, simply reload the current URL.
                    authCollab(true)
                    .then(() => {
                        // Register that we successfully logged in, so that we
                        // don't try to use a popup later when it will be
                        // blocked.
                        authSuccess = true;
                        nav.go(location.pathname, undefined, {force: true});
                    })
                    .catch(pages.join.failed);
                }
            }),
            common: renderCommon(state.theme, {
                changeTheme: name => {
                    state.theme = name;
                }
            }),
            setup: setupPage(dom.id('setup'), change, readState, {
                players: c.session().players.names,
                activePlayers: c.session().players.count,
                pairs: c.pairs(),
                go: nav.go
            }),
            table: tablePage(dom.id('table'), change, () => currentRequest, readState),
            playsetPreview: renderPlaysetPreview(dom.id('playset-preview'), withParams(() => currentRequest, {
                startSetup: request => {
                    state.playset = request.id;
                    change('playset', c.playset());
                    change('activePlayers', c.session().players.count);
                    c.session().players.names.forEach((name, i) => {
                        change('player', i, name);
                    });
                },
                resumeSetup: request => {
                    state.playset = request.id;
                    change('playset', c.playset());
                    change('activePlayers', c.session().players.count);
                    c.session().players.names.forEach((name, i) => {
                        change('player', i, name);
                    });
                },
                deletePlayset: request => {
                    const id = request.id;
                    const playset = allPlaysets[id];
                    deletedPlaysets[id] = true;
                    deletePlayset(playset);
                    change('playset', playset);
                },
                changeTitle: (title, request) => {
                    const id = request.id;
                    const playset = allPlaysets[id];
                    playset.title = title;
                    change('playset', playset);
                }
            })),
            players: renderPlayers(dom.id('players'), {
                changePlayerCount: count => {
                    change('activePlayers', count);
                },
                startSession: () => {
                    const id = state.googleDrive ? state.googleDrive.file : null;
                    connectToSession(id).then(result => {
                        collaborate = result.change;
                        state.googleDrive = { file: result.id };
                        nav.redirect(location.pathname, '?session=' + encodeURIComponent(result.id));
                    })
                    .catch(pages.players.sessionError);
                }
            }),
            help: renderHelp(dom.id('help')),
            version: renderVersion(dom.id('version'), config.version)
        };

        pages.playsets = renderPlaysets(dom.id('playsets'), {
            selectPlayset: id => {
                if ( id in deletedPlaysets ) {
                    const playset = allPlaysets[id];
                    delete deletedPlaysets[id];
                    savePlayset(playset);
                    change('playset', playset);
                }
            }
        });

        pages.addPlayset = renderAddPlayset(dom.id('add-playset'), {
            addPlaysetFiles: files => {
                files.forEach(addPlaysetFile);
                nav.go('/playsets');
                pages.playsets.focus();
            }
        });

        const queuePlaysetFile = createQueue(1);
        const addPlaysetFile = file => {
            pages.playsets.playsetLoadStarted();
            return queuePlaysetFile(() => loadDocument(file).then(pdf => {
                return loadPlaysetPagesFromPdf(pdf, file.name)
                .then(() => pdf.destroy());
            }))
            .catch(error => pages.playsets.playsetLoadFailed(file.name));
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
                R.range(0, playsets.length - 1).forEach(pages.playsets.playsetLoadStarted);
                return Promise.all(playsets.map((playset, index) => {
                    playset.id = uniqueIdentifier(simplifyString(playset.title), Object.keys(allPlaysets));
                    
                    if ( playset.subtitle.trim() === '' ) {
                        playset.subtitle = '...somewhere';
                    }
                    
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
            pages.playsets.playsetAdded(playset, playset.id in deletedPlaysets, loadPlaysetPageThumbnail);
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
                    pages.playsets.playsetLoadStarted();
                    addPlayset(playsets[id]);
                });
                allPlaysets = playsets;
                document.documentElement.classList.remove('loading');
                nav.start();
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

        function sessionInProgress(id) {
            return Boolean(state.sessions[id].players.count);
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
            State.write(state);
            savePlaysets();
        }
        
        function handleExit(event) {
            State.write(state);
            if ( savePlaysets() ) {
                return event.returnValue = 'Your playsets are currently being saved.';
            }
        }
    }
    
    const loadCollabOnce = R.memoize(loadCollab);
    start();
});
