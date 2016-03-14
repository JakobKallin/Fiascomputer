import * as dom from 'dom';

export default function(page, signal) {
    const states = ['inactive', 'loading', 'active'];

    function setState(newState) {
        states.forEach(state => {
            dom.first('.collaboration').classList.toggle(state, state === newState);
        });
    }
    
    [3, 4, 5].forEach(count => {
        dom.on(dom.id('players-link-' + count), 'click', event => {
            signal.changePlayerCount(count);
        });
    });
    
    dom.on(dom.first('.collaboration button'), 'click', () => {
        setState('loading');
        signal.startSession();
    });
    
    setState('inactive');
    
    function showLink(url) {
        const link = dom.id('join-link');
        link.textContent = url;
        link.href = url;
        setState('active');
        dom.selectText(link); // Last, because the link needs to be visible.
    }
    
    return {
        sessionReady: url => {
            showLink(url);
        },
        sessionError: error => {
            console.log(error);
            alert(error.message);
            setState('inactive');
        }
    };
}
