import pdfTest from './specs/pdf.spec';

mocha.setup({ ui: 'tdd' });
chai.config.truncateThreshold = 0;

suite('Fiascompanion', () => {
    suite('playset parsing', pdfTest);
});

mocha.checkLeaks();
mocha.run();
