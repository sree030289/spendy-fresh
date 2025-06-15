import { registerRootComponent } from 'expo';
import { NativeModuleInitializer } from './src/utils/NativeModuleInitializer';

import App from './App';

// Initialize native modules before app renders
NativeModuleInitializer.initializeModules();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
