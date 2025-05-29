import jwt from 'jsonwebtoken';

const generateToken = (id, email) => {
    return jwt.sign({ id, email }, process.env.JWT_SECRET, {
        expiresIn: process.env.TOKEN_EXPIRES_IN || '1d',
    });
};

export default generateToken;
