import * as R from 'ramda';
import * as dom from './dom.js';
import * as State from './state.js';
import * as Navigation from './navigation.js';
import * as Setup from './setup.js';
import { auth as authCollab, join as joinSession, loadHost, load as loadCollab } from './collaboration.js';
import joinPage from './pages/join.js';
import tablePage from './pages/table.js';
import setupPage from './pages/setup.js';
import renderCommon from './views/common.js';
import { tableFixture } from 'fixtures';

dom.on(document, 'DOMContentLoaded', () => {
    const state = State.read();
    dom.on(window, 'beforeunload', () => {
        State.write(R.pickBy((v, k) => k === 'theme', state));
    });

    let currentRequest = {};
    const root = '/join';
    const nav = dom.activateNavigation(location => {
        try {
            currentRequest = Navigation.handle(location, routes, handlers).params;
        }
        catch(error) {
            console.error(error);
            nav.redirect(root);
        }
    });
    
    const maxPlayers = 5;
    const playset = {
        title: 'stuff...',
        subtitle: '...somewhere',
        tables: {
            relationships: tableFixture('Relationships'),
            needs: tableFixture('Needs'),
            locations: tableFixture('Locations'),
            objects: tableFixture('Objects')
        }
    };
    state.pairs = R.range(0, maxPlayers).map(Setup.emptyPair);
    const playerNames = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE'];
    const activePlayers = maxPlayers;
    // Initial collaboration values are set before the proper collaboration
    // function is in place, but we don't yet need it at that point so just use
    // the identity function before that. (We need a named function because we
    // check below if the collaboration has been started, and just checking
    // against null will not work since a function is not null.)
    let collaborate = R.identity;
    let currentTable = null;
    
    const routes = {
        depth: 1,
        routes: routesWithSession([
            { start: [] },
            { setup: ['setup'] },
            { table: [
                {type:['relationship', 'detail']},
                {subtype:['category', 'element']},
                {pair: s => Number(s) - 1} // Zero-indexed pairs
            ] },
        ]),
        default: 'start'
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
    
    function change() {
        const args = [].slice.call(arguments);
        const type = args[0];
        if ( type === 'pair' ) {
            const index = args[1];
            const pair = args[2];
            change('relationship', index, pair.relationship);
            change('detail', index, pair.detail);
        }
        else if ( type === 'relationship' || type === 'detail' ) {
            const i = args[1];
            const item = args[2];
            state.pairs[i][type] = item;
            const changeMethod = type + 'Changed';
            pages.setup[changeMethod](i, Setup.showItem(playset, item));
            collaborate(type, i, item);
        }
        else if ( type === 'player' ) {
            const i = args[1];
            const name = args[2];
            pages.setup.playerNameChanged(i, name);
            collaborate('player', i, name);
        }
        else if ( type === 'activePlayers' ) {
            // Value might be null if host has not yet selected number of
            // players, so assume maximum so that we don't mess up the display
            // of the pairs.
            const count = args[1] || maxPlayers;
            R.range(0, maxPlayers).forEach(i => {
                const n = i + 1;
                document.documentElement.classList.toggle('players-' + n, n === count);
            });
            // The player dropdown causes an event before the view has even
            // returned, so we need to check for the page first.
            if (pages) pages.setup.playerCountChanged(count);
            collaborate('activePlayers', count);
        }
        else if ( type === 'title' ) {
            const title = args[1];
            playset.title = title;
            pages.setup.titleChanged(title);
        }
        else if ( type === 'subtitle' ) {
            const subtitle = args[1];
            playset.subtitle = subtitle;
            Object.keys(playset.tables).forEach(name => {
                playset.tables[name].subtitle = subtitle;
            });
            pages.table.subtitleChanged(subtitle);
        }
        else if ( type === 'category' ) {
            const table = args[1];
            const i = args[2];
            const text = args[3];
            playset.tables[table].categories[i] = text;
            renderSetup();
            if ( currentTable === table ) {
                pages.table.categoryChanged(i, text);
            }
        }
        else if ( type === 'element' ) {
            const table = args[1];
            const c = args[2];
            const i = args[3];
            const text = args[4];
            playset.tables[table].elements[c][i] = text;
            renderSetup();
            if ( currentTable === table ) {
                pages.table.elementChanged(c, i, text);
            }
        }
        else {
            console.log('Unhandled change type: ' + type);
        }
    }
    
    function renderSetup() {
        state.pairs.forEach((p, i) => {
            pages.setup.relationshipChanged(i, Setup.showItem(playset, p.relationship));
            pages.setup.detailChanged(i, Setup.showItem(playset, p.detail));
        });
    }
    
    const pages = {
        common: renderCommon(state.theme, {
            changeTheme: theme => {
                state.theme = theme;
            }
        }),
        join: joinPage(dom.id('join'), {
            login: () => {
                authCollab(true).then(startJoinProcess);
            }
        }),
        table: tablePage(dom.id('table'), change, () => currentRequest, () => state),
        setup: setupPage(dom.id('setup'), change, () => state, {
            pairs: state.pairs,
            players: playerNames,
            activePlayers: activePlayers
        })
    }
    
    const handlers = {
        start: request => {
            if ( 'session' in request && collaborate !== R.identity ) {
                nav.redirect(root + '/setup');
            }
            else {
                dom.showPage('join');
                if ( !('session' in request) ) {
                    pages.join.empty();
                }
            } 
        },
        setup: requireSession(request => {
            dom.showPage('setup')
        }),
        table: requireSession(request => {
            dom.showPage('table')
            const i = request.pair;
            const type = request.type;
            const subtype = request.subtype;
            const tableName = state.pairs[i][type].table;
            currentTable = tableName; // Keep track to target change event properly above.
            const category = subtype === 'element' ? state.pairs[i][type].category : null;
            pages.table.changed(playset.tables[tableName], category);
        })
    };
    
    function requireSession(handler) {
        return function(request) {
            if ('session' in request && collaborate !== R.identity) {
                return handler(request);
            }
            else {
                nav.redirect(root + '/');
            }
        };
    }
    
    function startJoinProcess() {
        return connectToSession(currentRequest.session)
        .then(() => {
            nav.redirect(root + '/setup', undefined, {force: true});
        })
        .catch(error => {
            pages.join.failed(error);
        });
    }
    
    function connectToSession(session) {
        dom.showPage('join');
        pages.join.loading();
        return joinSession(session, {
            change: change,
            playerJoined: pages.common.playerJoined,
            playerLeft: pages.common.playerLeft
        })
        .then(result => {
            collaborate = result.change;
            return result;
        })
        .catch(error => {
            pages.join.failed(error);
            throw error;
        });
    }
    
    loadCollab().then(() => authCollab())
    .then(() => {
        document.documentElement.classList.remove('loading');
        pages.join.loading();
        nav.start();
        startJoinProcess();
    })
    .catch(() => {
        document.documentElement.classList.remove('loading');
        pages.join.login();
        nav.start();
    });
});
