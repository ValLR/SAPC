import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'sapc_jwt_token';
const USER_KEY = 'sapc_user_data';

// Objeto en memoria para fallback en entornos web si localStorage no está disponible
const memoryStorage = {};

/**
 * Servicio de Almacenamiento Seguro (JWT & Usuario)
 * Utiliza `expo-secure-store` en iOS y Android con cifrado nativo.
 * Para web, utiliza `localStorage` o fallback en memoria.
 */
export const storageService = {
  /**
   * Guarda el token JWT de sesión
   * @param {string} token
   */
  async saveToken(token) {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(TOKEN_KEY, token);
        } else {
          memoryStorage[TOKEN_KEY] = token;
        }
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
    } catch (error) {
      console.error('Error al guardar token seguro:', error);
    }
  },

  /**
   * Obtiene el token JWT guardado
   * @returns {Promise<string|null>}
   */
  async getToken() {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(TOKEN_KEY);
        }
        return memoryStorage[TOKEN_KEY] || null;
      }
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error('Error al recuperar token seguro:', error);
      return null;
    }
  },

  /**
   * Elimina el token JWT guardado
   */
  async removeToken() {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(TOKEN_KEY);
        }
        delete memoryStorage[TOKEN_KEY];
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    } catch (error) {
      console.error('Error al eliminar token seguro:', error);
    }
  },

  /**
   * Guarda los datos del usuario autenticado
   * @param {Object} user
   */
  async saveUser(user) {
    try {
      const jsonUser = JSON.stringify(user);
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(USER_KEY, jsonUser);
        } else {
          memoryStorage[USER_KEY] = jsonUser;
        }
      } else {
        await SecureStore.setItemAsync(USER_KEY, jsonUser);
      }
    } catch (error) {
      console.error('Error al guardar usuario en almacenamiento seguro:', error);
    }
  },

  /**
   * Obtiene los datos del usuario autenticado
   * @returns {Promise<Object|null>}
   */
  async getUser() {
    try {
      let jsonUser = null;
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          jsonUser = window.localStorage.getItem(USER_KEY);
        } else {
          jsonUser = memoryStorage[USER_KEY] || null;
        }
      } else {
        jsonUser = await SecureStore.getItemAsync(USER_KEY);
      }
      return jsonUser ? JSON.parse(jsonUser) : null;
    } catch (error) {
      console.error('Error al recuperar usuario de almacenamiento seguro:', error);
      return null;
    }
  },

  /**
   * Elimina los datos del usuario guardado
   */
  async removeUser() {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(USER_KEY);
        }
        delete memoryStorage[USER_KEY];
      } else {
        await SecureStore.deleteItemAsync(USER_KEY);
      }
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
    }
  },

  /**
   * Limpia toda la sesión (Token + Usuario)
   */
  async clearSession() {
    await this.removeToken();
    await this.removeUser();
  },
};

export default storageService;
