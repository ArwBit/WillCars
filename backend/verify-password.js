const bcrypt = require('bcryptjs');
const storedHash = '$2b$10$2/uliVzkfztfie21bDnmiOTxk2UgcsKUDLJB/7Y0Fii2eLkA1DsIe';
const password = 'HhKk1w2j8*2121';

bcrypt.compare(password, storedHash).then(isMatch => {
    console.log('Password match:', isMatch);
});