import getConfig from './getConfig';
import beginSync from './beginSync';

beginSync(getConfig())
    .then(() => { console.log('Finished') })
    .catch(error => { throw error });
