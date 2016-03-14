import * as dom from 'dom';

export default function(page, signal) {
    const states = ['login', 'empty', 'loading', 'error'];
    
    function setState(newState) {
        states.forEach(state => {
            page.classList.toggle(state, state === newState);
        });
    }
    
    dom.on(dom.first('button', page), 'click', () => {
        signal.login();
    });
    
    return {
        login: () => setState('login'),
        empty: () => setState('empty'),
        loading: () => setState('loading'),
        failed: error => {
            setState('error');
            dom.first('.error-details', page).textContent = error.message;
        }
    };
}
