import getConfig from './getConfig.mjs';
import beginSync from './beginSync.mjs';

beginSync(getConfig())
    .then(() => { console.log('Finished') })
    .catch(error => { throw error });
