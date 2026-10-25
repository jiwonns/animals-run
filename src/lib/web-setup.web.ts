import { Asset } from 'expo-asset';

// Native Alert.alert is a no-op on web. AppDialogHost patches it to the in-app dialog.

function addToHead(tag: 'link' | 'meta', attributes: Record<string, string>) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  document.head.appendChild(element);
}

// Icon draws Material Symbols (the Android names) with this font on web.
const iconFont=Asset.fromModule(require('@expo-google-fonts/material-symbols/400Regular/MaterialSymbols_400Regular.ttf')).uri;
const iconStyle=document.createElement('style');
iconStyle.textContent=`@font-face{font-family:'Material Symbols Rounded';font-style:normal;font-weight:400;font-display:block;src:url('${iconFont}') format('truetype');}`;
document.head.appendChild(iconStyle);

// Icon and name for Safari's "Add to Home Screen".
addToHead('link', { rel: 'apple-touch-icon', href: Asset.fromModule(require('../../assets/images/icon.png')).uri });
addToHead('meta', { name: 'apple-mobile-web-app-title', content: 'Animals Run' });
addToHead('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
addToHead('meta', { name: 'theme-color', content: '#FB7103' });
