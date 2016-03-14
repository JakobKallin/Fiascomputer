import * as dom from 'dom';
import * as R from 'ramda';

export default function(theme, signal) {
    dom.activateMenu({
        menu: dom.id('menu'),
        button: dom.id('menu-button')
    });
    
    dom.activateFullscreenButtons({
        enter: dom.id('enter-fullscreen-control'),
        leave: dom.id('leave-fullscreen-control')
    });
    
    dom.activateThemeDropdown(
        dom.id('theme-control'),
        theme,
        signal.changeTheme
    );
    
    dom.activateToggle({
        element: dom.id('player-list'),
        button: dom.id('player-list-button'),
        class: 'player-list'
    });
    
    
    const playerContainer = dom.id('player-list');
    const playerTemplate = playerContainer.firstElementChild;
    playerTemplate.remove();
    let players = [];
    function renderPlayers() {
        const uniquePlayers = R.uniqBy(c => c.userId, players);
        const count = uniquePlayers.length;
        const text = count + ' ' + (count === 1 ? 'player' : 'players');
        dom.id('player-list-button').textContent = text;
        dom.id('player-list-button').className = 'players-' + count;
        
        dom.replicate(uniquePlayers, playerTemplate, playerContainer, (node, player) => {
            dom.first('.player-image', node).src = player.photoUrl;
            dom.first('.player-name', node).textContent = player.displayName;
        });
    }
    
    function addPlayer(player) {
        players.push(player);
        renderPlayers();
    }
    
    function removePlayer(player) {
        players = players.filter(p => p.sessionId !== player.sessionId);
        renderPlayers();
    }
    
    renderPlayers();
    
    return {
        playerJoined: addPlayer,
        playerLeft: removePlayer
    }
}
