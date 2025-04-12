import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 🔧 Reconstruimos __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Ruta al archivo temporal de usuarios
const usersPath = path.join(__dirname, '../temp/users.json');

// 📖 Leer usuarios desde archivo JSON
export const readUsers = () => {
    if (!fs.existsSync(usersPath)) {
        fs.writeFileSync(usersPath, '[]'); // crear archivo vacío si no existe
    }
    const data = fs.readFileSync(usersPath);
    return JSON.parse(data);
};

// 📝 Escribir usuarios en archivo JSON
export const writeUsers = (users) => {
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
};

// 🔍 Buscar usuario por email
export const getUserByEmail = (email) => {
    const users = readUsers();
    return users.find(user => user.email === email);
};

export const getUserById = async (id) => {
    const users = await readUsers();
    return users.find(user => user.id === id);
};

// ➕ Crear usuario
export const createUser = (user) => {
    const users = readUsers();
    users.push(user);
    writeUsers(users);
};
