import * as dom from 'dom';

export default function(page, signal) {
    const addNode = dom.remove(first('.add-playset'));
    
    function first(selector) {
        return dom.first(selector, page);
    }
    
    const templates = {
        playset: dom.remove(first('.playset'))
    };
    const elements = {};
    function insert(id, templateName, containerSelector, properties) {
        elements[templateName] = elements[templateName] || {};
        if ( !(id in elements[templateName]) ) {
            const container = first(containerSelector);
            const instance = templates[templateName].cloneNode(true);
            container.appendChild(instance);
            elements[templateName][id] = instance;
        }
        update(id, templateName, properties);
        return elements[templateName][id];
    }

    function update(id, templateName, properties) {
        const element = elements[templateName][id];
        setElementProperties(element, properties);
    }

    function setElementProperties(ancestor, mapping) {
        Object.keys(mapping).forEach(selector => {
            const properties = mapping[selector];
            Object.keys(properties).forEach(property => {
                const subvalue = properties[property];
                const elements = dom.all(selector, ancestor).concat(
                    dom.matches(ancestor, selector) ? [ancestor] : []
                );
                elements.forEach(e => {
                    if ( property === 'text' ) {
                        e.textContent = subvalue;
                    }
                    else if ( property === 'data' ) {
                        Object.keys(subvalue).forEach(dataProperty => {
                            const dataValue = subvalue[dataProperty];
                            e.dataset[dataProperty] = dataValue;
                        });
                    }
                    else if ( property === 'class' ) {
                        Object.keys(subvalue).forEach(cls => {
                            e.classList.toggle(cls, Boolean(subvalue[cls]));
                        });
                    }
                    else if ( subvalue === null ) {
                        e.removeAttribute(property);
                    }
                    else {
                        e[property] = subvalue;
                    }
                });
            });
        });
    }

    first('.playsets').appendChild(addNode);

    let loading = 0;
    function updateLoadingIndicator(change) {
        loading += change;
        page.classList.toggle('loading', loading > 0);
    }

    function updatePlayset(playset, cover, deleted) {
        return insert(playset.id, 'playset', '.playsets', {
            '.playset': { class: { deleted: deleted } },
            '.playset-name':  { text: playset.title },
            '.playset-thumbnail':  { src: cover },
            '.playset-link':  { href: '/playsets/' + encodeURIComponent(playset.id) }
        });
    }

    return {
        playsetAdded: function(playset, deleted, loadPlaysetPage) {
            // Add it immediately to get the right ordering, but hide until
            // image is ready.
            const node = updatePlayset(playset, '/images/blank-page.svg', deleted);
            node.hidden = true;
            loadPlaysetPage(playset.pages[0]).then(cover => {
                updateLoadingIndicator(-1);
                node.hidden = false;
                updatePlayset(playset, cover, deleted);
                node.addEventListener('click', function() {
                    signal.selectPlayset(playset.id);
                });
                first('.playsets').appendChild(addNode);
            });
        },
        playsetLoadStarted: function() {
            updateLoadingIndicator(+1);
        },
        playsetLoadFailed: function(name) {
            updateLoadingIndicator(-1);
            alert('Sorry, we could not load the playset in file "' + name + '".')
        },
        playsetChanged: function(playset, deleted, loadPlaysetPage) {
            loadPlaysetPage(playset.pages[0]).then(cover => updatePlayset(playset, cover, deleted));
        },
        focus: function() {
            document.querySelector('.playsets', page).lastElementChild.scrollIntoView();
        }
    };
}
