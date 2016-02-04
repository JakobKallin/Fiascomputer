import R from 'ramda';
import * as dom from 'dom';
import { parseInteger } from 'utils';

export default function(playerNames, maxPlayers, playerCount, page, signal) {
    const node = {
        pair: index => dom.all('.pair')[index],
        relationship: index => dom.all('[data-relationship]')[index],
        detail: index => dom.all('[data-detail]')[index]
    };

    const templates = {};
    ['pair', 'player'].forEach((name, index) => {
        const node = templates[name] = document.getElementById(name + '-template');
        node.parentNode.removeChild(node);
    });
    ['pair', 'player'].forEach(card => {
        R.range(0, maxPlayers).forEach(index => {
            const number = index + 1;
            const node = templates[card].cloneNode(true);
            node.id = card + '-' + number;
            dom.all('a', node).forEach(link => link.href += '/' + number);
            dom.id('pairs').appendChild(node);
        });
    });
    
    renderPlayerNames(playerNames);

    const randomButton = document.querySelector('#randomize-button');
    randomButton.addEventListener('click', event => {
        signal.randomizeSetup();
    });

    R.range(0, maxPlayers).forEach(index => {
        bindClicks(node.pair(index), {
            '.relationship-category-die': () => signal.randomizeRelationshipCategory(index),
            '.relationship-element-die': () => signal.randomizeRelationshipElement(index),
            '.detail-category-die': () => signal.randomizeDetailCategory(index),
            '.detail-element-die': () => signal.randomizeDetailElement(index),
            '.relationship-category-remove': () => signal.removeRelationshipCategory(index),
            '.relationship-element-remove': () => signal.removeRelationshipElement(index),
            '.detail-remove': () => signal.changeDetailType(index, null),
            '.detail-category-remove': () => signal.removeDetailCategory(index),
            '.detail-element-remove': () => signal.removeDetailElement(index)
        });
    });

    function bindClicks(node, table) {
        R.mapObjIndexed((listener, selector) => {
            const button = dom.first(selector, node);
            dom.on(button, 'click', listener);
        }, table);
    }

    function renderPlayset(playset) {
        dom.first('.playset-name-text', page).textContent = playset.title;
    }

    function renderPair(pair, index) {
        renderItem(pair.relationship, node.relationship(index));
        renderDetail(pair.detail, node.detail(index));
    }

    function renderItem(item, node) {
        renderCategory(item.category, node);
        renderElement(item.element, node);
    }

    function renderCategory(category, node) {
        dom.toggleClass(dom.first('.category', node), { removable: category });
        const display = category ? category : {
            name: 'Select category...',
            die: 0
        };

        dom.first('.category .name', node).textContent = display.name;
        dom.first('.category .die', node).textContent = display.die;
    }

    function renderElement(element, node) {
        dom.toggleClass(dom.first('.element', node), { removable: element });
        const display = element ? element : {
            name: 'Select element...',
            die: 0
        };

        dom.first('.element .name', node).textContent = display.name;
        dom.first('.element .die', node).textContent = display.die;
    }

    function renderDetail(detail, node) {
        renderDetailType(detail.table, node);
        renderItem(detail, node);
    }

    function enableDetailSelector(index) {
        ['need', 'location', 'object'].forEach(type => {
            const button = dom.first('.' + type + '-control', node.detail(index));
            dom.on(button, 'click', () => signal.changeDetailType(index, type));
        });
    }

    function enablePlayerNameEditing(index) {
        dom.makeEditable({
            node: dom.all('.player-name', page)[index],
            trigger: dom.all('.player .edit', page)[index],
            change: text => signal.changePlayerName(index, text)
        });
    }

    function renderDetailType(table, node) {
        node.classList.remove('need');
        node.classList.remove('location');
        node.classList.remove('object');

        if ( table !== null ) {
            const name = {
                needs: 'Need',
                locations: 'Location',
                objects: 'Object'
            }[table];
            node.classList.add(name.toLowerCase());
            dom.first('.detail-heading', node).textContent = name;
        }
    }
    
    function renderPlayerNames(names) {
        dom.all('.player', page).forEach((node, index) => {
            dom.first('.player-name', node).textContent = names[index];
        });
    }

    dom.makeEditable({
        node: dom.first('.playset-name-text', page),
        trigger: dom.first('.playset-name .edit', page),
        change: signal.changeTitle
    });

    R.range(0, maxPlayers).forEach(enableDetailSelector);
    R.range(0, maxPlayers).forEach(enablePlayerNameEditing);
    
    const playerDropdown = dom.id('player-count-control');
    dom.select(
        playerDropdown,
        value => signal.changePlayerCount(parseInteger(value)),
        playerCount
    );

    return {
        renderRelationship: function(index, relationship) {
            renderItem(relationship, node.relationship(index));
        },
        renderDetail: function(index, detail) {
            renderDetail(detail, node.detail(index));
        },
        renderSetup: function(playset, pairs, playerNames, playerCount) {
            renderPlayset(playset);
            pairs.forEach((pair, index) => renderPair(pair, index));
            renderPlayerNames(playerNames);
            playerDropdown.value = playerCount;
        }
    };
}
