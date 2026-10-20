import { Image as ExpoImage, type ImageProps } from 'expo-image';
import { useEffect, useState } from 'react';
import { loadGachaImage } from '@/lib/gacha-images';
export type { ImageStyle } from 'expo-image';

/** Existing HTTPS assets use Expo's disk cache; admin uploads resolve lazily from Firestore on Spark. */
export function Image(props: ImageProps) {
  const source = props.source;
  const uri = source && typeof source === 'object' && 'uri' in source && typeof source.uri === 'string' && source.uri.startsWith('gacha-image:') ? source.uri : null;
  const [resolved,setResolved] = useState<{ uri:string;data:string } | null>(null);
  useEffect(()=>{
    if (!uri) return;
    let alive=true;
    void loadGachaImage(uri).then(data=>{if(alive)setResolved({uri,data});}).catch(()=>{});
    return ()=>{alive=false;};
  },[uri]);
  return <ExpoImage {...props} source={uri ? resolved?.uri===uri ? {uri:resolved.data} : null : source} cachePolicy={props.cachePolicy ?? 'disk'} />;
}
