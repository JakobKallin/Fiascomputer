import renderSetup from '../views/setup.js';
import * as setup from '../setup.js';
import { withParams } from 'utils';

export default function(root, change, readState, options) {
    const maxPlayers = options.players.length;
    return renderSetup(root, options, withParams(readState, {
        randomizeSetup: (state) => {
            const activePlayers = state.players.count;
            const pairs = setup.randomSetup(activePlayers, maxPlayers);
            pairs.forEach((p, i) => change('pair', i, p));
        },
        randomizeRelationshipCategory: (i, state) => {
            const item = state.pairs[i].relationship;
            change('relationship', i, setup.randomCategory('relationships', item.category));
        },
        randomizeRelationshipElement: (i, state) => {
            const item = state.pairs[i].relationship;
            change('relationship', i, setup.randomElement(
                'relationships',
                item.category,
                item.element
            ));
        },
        randomizeDetailCategory: (i, state) => {
            const item = state.pairs[i].detail;
            change('detail', i, setup.randomCategory(item.table, item.category));
        },
        randomizeDetailElement: (i, state) => {
            const item = state.pairs[i].detail;
            change('detail', i, setup.randomElement(
                item.table,
                item.category,
                item.element
            ));
        },
        removeRelationshipCategory: i => {
            change('relationship', i, {
                table: 'relationships',
                category: null,
                element: null
            });
        },
        removeRelationshipElement: (i, state) => {
            const category = state.pairs[i].relationship.category;
            change('relationship', i, {
                table: 'relationships',
                category: category,
                element: null
            });
        },
        removeDetailCategory: (i, state) => {
            const table = state.pairs[i].detail.table;
            change('detail', i, {
                table: table,
                category: null,
                element: null
            });
        },
        removeDetailElement: (i, state) => {
            const table = state.pairs[i].detail.table;
            const category = state.pairs[i].detail.category;
            change('detail', i, {
                table: table,
                category: category,
                element: null
            });
        },
        changeDetailType: (i, type, state) => {
            const table = type === null ? null : type + 's';
            const category = state.pairs[i].detail.category;
            const element = state.pairs[i].detail.element;
            // We keep the existing category and element, because the user
            // might have made a mistake and want to recover the old values.
            change('detail', i, {
                table: table,
                category: category,
                element: element
            });
        },
        changeTitle: title => {
            change('title', title);
        },
        changePlayerName: (i, name) => {
            change('player', i, name);
        },
        changePlayerCount: count => {
            change('activePlayers', count);
        },
        invitePlayers: () => {
            options.go('/players');
        }
    }));
}
