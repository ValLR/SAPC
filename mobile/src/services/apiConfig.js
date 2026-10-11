import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Obtiene dinámicamente la IP del servidor backend:
 * 1. Si existe EXPO_PUBLIC_API_URL en el entorno, usa esa URL directamente.
 * 2. Si corre bajo Expo Go o Metro, detecta la IP del host de desarrollo (tu PC).
 * 3. En emulador Android local, usa 10.0.2.2.
 * 4. Por defecto, localhost.
 */
export const getHostIp = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.developer?.manifest?.debuggerHost;

  if (hostUri) {
    return hostUri.split(':')[0];
  }
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
};

const DEFAULT_API_URL = `http://${getHostIp()}:3000/api`;
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;

export default API_BASE_URL;
