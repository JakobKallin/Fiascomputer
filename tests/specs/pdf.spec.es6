import R from 'ramda';
import { default as loadPdf, loadPlaysets } from '../../source/pdf.js';
import { default as validatePlayset, logPlayset } from '../../source/validate-playset.js';

export default function() {
    const assert = chai.assert;
    const assertEqual = chai.assert.deepEqual;
    const assertError = chai.assert.throws;
    const assertAbove = chai.assert.isAbove;
    const assertNotEqual = chai.assert.notEqual;
    
    [
        'fiasco',
        'fiasco_companion',
        'ak02_heroes_of_pinnacle_city',
        'br01_de_medici',
        'bt01_jersey_side',
        'cb01_los_angeles_1936',
        'cb02_dallas_1963',
        'cb03_havana_1953',
        'cn01_news_channel_six',
        'Dangerous Games Fiasco Playset',
        'db01_tartan_noir',
        'dcj01_alpha_complex',
        'dp01_manna_hotel',
        'dp02_the_penthouse',
        'el01_transatlantic',
        'gs01_hk_tpk',
        'gw01_gangster_london',
        'gw02_unaussprechlichen_klutzen',
        'jb01_hollywood_wives',
        'jc01_horse_fever',
        'jg01_camp_death',
        'jg06_return_to_camp_death',
        'jl01_objective_zebra',
        'jm05_touring_rock_band',
        'jm06_last_frontier',
        'jm07_lucky_strike',
        'jm08_flyover',
        'jm09_1913_new_york',
        'jm12_home_invasion',
        'jm17_rat_patrol',
        'jm18_sucker_creek',
        'jw01_golden_panda',
        'lb01_dragon_slayers',
        'lb02_dc73',
        'lb03_salem_1692',
        'mc01_red_front',
        'mp01_break_a_leg',
        'planeta_droga',
        'rc01_white_hole',
        'sb01_back_to_the_old_house',
        'sg01_town_and_gown',
        'tg01_reconstruction',
        'trb02_touring_rock_band_2',
        'tt01_saturday_night_78',
        'wh01_london_1593',
        'wh02_the_zoo',
        'wh03_flight_1180'
    ].forEach(name => {
        test('PDF: ' + name, () => {
            return loadPdf('/tests/playsets/' + name + '.pdf').then(pdf => {
                return loadPlaysets(pdf)
                .then(playsets => {
                    pdf.destroy();
                    
                    playsets.forEach(playset => {
                        console.group(name);
                        logPlayset(playset);
                        console.groupEnd();

                        const errors = validatePlayset(playset);
                        if ( errors.length > 0 ) {
                            throw new Error(errors[0]);
                        }
                    });
                });
            });
        });
    });
};
