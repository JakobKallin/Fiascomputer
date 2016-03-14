import * as dom from 'dom';
import { contains } from 'utils';

export default function(page, current) {
    dom.on(dom.first('.close-button', page), 'click', event => {
        history.back();
    });
    
    dom.on(dom.first('.start-button', page), 'click', event => {
        history.back();
    });
    
    const versions = dom.all('.version', page).map(node => {
        return node.id.replace('version-', '');
    });
    
    function updateVersion(version) {
        version = contains(versions, version) ? version : current;
        dom.all('.version', page).forEach(node => {
            node.classList.toggle('current', node.id === 'version-' + version);
        });
        dom.id('version-number').textContent = version;
    }
    
    updateVersion(current);
    
    return {
        versionChanged: updateVersion
    };
}
