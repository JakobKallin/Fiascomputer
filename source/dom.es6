import { contains } from 'utils';

export function clear(node) {
    while ( node.firstChild ) {
        node.removeChild(node.firstChild);
    }
}

export function remove(node) {
    return node.parentNode.removeChild(node);
}

export function all(selector, node) {
    node = node || document;
    return [].slice.call(node.querySelectorAll(selector));
}

export function first(selector, node) {
    node = node || document;
    return node.querySelector(selector)
}

export function id(id) {
    return document.getElementById(id);
}

export function set(element, attribute, value) {
    if ( value === null ) {
        element.removeAttribute(attribute);
    }
    else {
        element[attribute] = value;
    }
}

export function on(node, event, listener) {
    node.addEventListener(event, listener);
}

export function capture(node, event, listener) {
    node.addEventListener(event, listener, true);
}

// Attach a change listener to a select control and trigger it once right away.
export function select(node, listener, initial) {
    const domListener = () => {
        listener(node.value);
    };
    on(node, 'change', domListener);
    if ( initial !== undefined ) {
        node.value = initial;
    }
    domListener();
}

export function toggleClass(node, table) {
    Object.keys(table).forEach(className => {
        const value = table[className];
        value ? node.classList.add(className) : node.classList.remove(className);
    });
}

export function selectFiles() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'application/pdf';
        on(input, 'change', event => {
            resolve([].slice.call(input.files));
        });
        input.style.display = 'none';
        // TODO: The input should be removed as soon as possible (which is
        // probably the next time files are selected, leaving at most one input
        // in the document at any given point in time).
        document.body.appendChild(input);
        input.click();
    });
}

export function drag(node, callbacks) {
    on(node, 'dragover', event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        callbacks.before();
    });
    
    on(node, 'drop', event => {
        event.preventDefault();
        callbacks.drop([].slice.call(event.dataTransfer.files));
        callbacks.after();
    });
    
    on(node, 'dragleave', event => {
        event.preventDefault();
        callbacks.after();
    });
}

export function replicate(values, template, container, callback) {
    clear(container);
    if ( !Array.isArray(values) ) {
        values = [values];
    }
    values.forEach((value, index) => {
        const instance = template.cloneNode(true);
        container.appendChild(instance);
        callback(instance, value, index);
    });
}

export function key(event) {
    return {
        13: 'enter',
        27: 'escape',
        37: 'left',
        39: 'right'
    }[event.which] || event.which;
}

export function makeEditable(options) {
    const editableNode = options.node;
    const triggerNode = options.trigger;
    
    ensureStrut();
    
    on(triggerNode, 'click', () => {
        editableNode.contentEditable = 'true';
        editableNode.focus();
        document.execCommand('selectAll', false, null);
        if ( options.focus ) {
            options.focus();
        }
    });
    on(editableNode, 'blur', () => {
        ensureStrut();
        // Check that the node is `contentEditable` first, because blur can also
        // happen when a link loses focus. This has triggered unnecessary errors
        // caused by lack of context in the change handler because another page
        // has been loaded than the one that the editable element is on.
        if ( options.node.contentEditable === 'true' && options.change ) {
            options.change(editableNode.textContent);
        }
    });
    on(editableNode, 'paste', event => {
        // Plain text copying
        event.preventDefault();
        editableNode.textContent = event.clipboardData.getData('text/plain');
    });
    on(editableNode, 'keydown', event => {
        if ( key(event) === 'escape' || key(event) === 'enter' ) {
            event.preventDefault();
            editableNode.blur();
        }
    });
    on(editableNode, 'blur', () => {
        editableNode.contentEditable = 'false';
        if ( options.blur ) {
            options.blur();
        }
    });
    
    // If the element is an editable link, we want to prevent the link from
    // working. While removing the `href` would also work, that would not stop
    // `click` event listeners from taking effect.
    if ( options.node.tagName === 'A' ) {
        capture(options.node.parentNode, 'click', event => {
            if ( options.node.isContentEditable ) {
                event.stopPropagation();
            }
        });
    }
    
    // Make sure that nodes cannot "disappear" by having their contents emptied
    // and suddenly no longer taking up any height. Also known as "strut".
    function ensureStrut() {
        if ( editableNode.textContent.trim() === '' ) {
            editableNode.innerHTML = '&nbsp;';
        }
    }
}

export function matches(element, selector) {
    if ( element.matches ) {
        return element.matches(selector);
    }
    else {
        return element.msMatchesSelector(selector);
    }
}

export function closest(element, selector) {
    if ( element.closest ) {
        return element.closest(selector);
    }
    else {
        return msClosest(element, selector);
    }
}

function msClosest(element, selector) {
    if ( !element ) {
        return element;
    }
    else if ( matches(element, selector) ) {
        return element;
    }
    else {
        return msClosest(element.parentNode, selector);
    }
}

export function origin(link) {
    if ( link.origin ) {
        return link.origin;
    }
    else {
        return link.protocol + '//' + link.hostname;
    }
}

export function enterFullscreen() {
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
}

export function leaveFullscreen() {
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
}

export function activateMenu(options) {
    const menu = options.menu;
    const button = options.button;
    
    on(button, 'click', () => {
        const dataset = document.documentElement.dataset;
        dataset.menu = dataset.menu === 'false' ? 'true' : 'false';
    });
    
    on(menu, 'change', event => {
        document.documentElement.dataset.menu = 'false';
    });

    on(document, 'click', event => {
        const menuButtonWasClicked = event.target === button;
        if ( !menuButtonWasClicked ) {
            const elementOutsideMenuWasClicked = !menu.contains(event.target);
            const controlInsideMenuWasClicked =
                !elementOutsideMenuWasClicked && (
                    event.target.tagName === 'A' || event.target.tagName === 'BUTTON'
                );
            if ( elementOutsideMenuWasClicked || controlInsideMenuWasClicked ) {
                document.documentElement.dataset.menu = 'false';
            }
        }
    });
}

export function activateToggle(options) {
    const element = options.element;
    const button = options.button;
    const className = options.class;
    
    on(button, 'click', () => {
        document.documentElement.classList.toggle(className);
    });

    on(document, 'click', event => {
        const buttonWasClicked = event.target === button;
        if ( !buttonWasClicked ) {
            const elementOutsideWasClicked = !element.contains(event.target);
            const controlInsideWasClicked =
                !elementOutsideWasClicked && (
                    event.target.tagName === 'A' || event.target.tagName === 'BUTTON'
                );
            if ( elementOutsideWasClicked || controlInsideWasClicked ) {
                document.documentElement.classList.remove(className);
            }
        }
    });
}

export function isInFullscreen() {
    return Boolean(
        document.webkitFullscreenElement ||
        document.mozFullscreenElement ||
        document.fullscreenElement
    );
}

function onFullscreenChange(callback) {
    [
        'webkitfullscreenchange',
        'mozfullscreenchange',
        'fullscreenchange'
    ].forEach(element => {
        on(document, element, event => callback());
    });
}

export function activateFullscreenButtons(options) {
    var enterButton = options.enter;
    var leaveButton = options.leave;
    
    onFullscreenChange(() => {
        document.documentElement.classList.toggle('fullscreen', isInFullscreen());
    });

    on(enterButton, 'click', enterFullscreen);
    on(leaveButton, 'click', leaveFullscreen);
}

export function activateThemeDropdown(dropdown, initial, onChange) {
    select(dropdown, event => {
        const name = dropdown.value;
        const stylesheets = all('link[rel~=stylesheet][title]', document.head);
        stylesheets.forEach(link => link.disabled = true);
        stylesheets.filter(link => contains(link.href, name))[0].disabled = false;
        onChange(name);
    }, initial);
}

export function activateNavigation(onPageChange) {
    on(document, 'click', event => {
        const link = closest(event.target, 'a');
        if ( link ) {
            const internal = origin(link) === location.origin;
            const opensInNewWindow = link.hasAttribute('target');
            if ( internal && !opensInNewWindow ) {
                event.preventDefault();
                history.pushState(null, '', link.href + location.search);
                onPageChange(location);
            }
        }
    });
    
    on(window, 'popstate', () => onPageChange(location));
    
    return {
        go: (path, search, options) => {
            if ( path !== location.pathname || options.force ) {
                const after = path + (search === undefined ? location.search : search);
                history.pushState(null, '', after);
                onPageChange(location);
            }
        },
        redirect: (path, search, options) => {
            const before = location.pathname + location.search;
            const after = path + (search === undefined ? location.search : search);
            if ( after !== before || options.force ) {
                history.replaceState(null, '', after);
                onPageChange(location);
            }
        },
        start: () => onPageChange(location)
    };
}

export function showPage(name, title, literalTitle) {
    const pages = all('main > .page');
    const activePage = pages.filter(p => p.id === name)[0];
    if ( !activePage ) {
        throw new Error('No such page: ' + name);
    }
    
    pages.forEach(page => {
        page.hidden = page !== activePage;
    });
    
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

export function selectText(element) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
}

export function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.addEventListener('load', () => resolve());
        script.addEventListener('error', () => reject());
        document.head.appendChild(script);
    });
}
