import * as dom from 'dom';

export default function(page, signal) {
    dom.on(dom.id('start-setup-control'), 'click', signal.startSetup);
    dom.on(dom.id('resume-setup-control'), 'click', signal.resumeSetup);
    dom.on(dom.id('delete-playset-control'), 'click', signal.deletePlayset);
    
    dom.makeEditable({
        node: dom.first('.playset-name-text', page),
        trigger: dom.first('.playset-name .edit', page),
        change: signal.changeTitle
    });

    return (playset, page, alreadyStarted, loadCoverPage, loadScorePage, loadCreditsPage) => {
        const coverLink = dom.id('playset-cover-page-link');
        coverLink.removeAttribute('href');
        loadCoverPage().then(src => {
            coverLink.href = src;
            dom.id('playset-cover-page').src = src;
        });
        
        const scoreLink = dom.id('playset-score-page-link');
        scoreLink.removeAttribute('href');
        // Hide first, because there might not be a score page. If there is one,
        // we unhide it later.
        dom.id('playset-score-page').hidden = false;
        loadScorePage().then(src => {
            scoreLink.href = src;
            dom.id('playset-score-page').src = src;
        }).catch(() => dom.id('playset-score-page').hidden = true);
        
        dom.first('.playset-name-text', page).textContent = playset.title;
        
        dom.first('.play-link', page).hidden = alreadyStarted;
        dom.first('.resume-link', page).hidden = !alreadyStarted;
        
        const creditsLink = dom.id('playset-credits-page-link');
        creditsLink.hidden = true;
        loadCreditsPage().then(src => {
            creditsLink.href = src;
            creditsLink.hidden = false;
        });
    };
}
