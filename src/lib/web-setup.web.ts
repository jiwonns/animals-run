import { Asset } from 'expo-asset';
import { Alert, type AlertButton } from 'react-native';

// react-native-web's Alert.alert does nothing, which would leave confirm flows (logout, hatch, leave) stuck.
// The app never shows more than two buttons, so the browser's alert/confirm covers every case.
Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
  const text = [title, message].filter(Boolean).join('\n\n');
  const list = buttons ?? [];
  const cancel = list.find((b) => b.style === 'cancel');
  const confirm = list.find((b) => b !== cancel);
  if (!cancel || !confirm) {
    window.alert(text);
    (confirm ?? cancel)?.onPress?.();
    return;
  }
  if (window.confirm(text)) confirm.onPress?.();
  else cancel.onPress?.();
};

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
