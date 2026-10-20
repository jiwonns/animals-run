import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { db } from './firebase';
import { useSession } from '@/providers/session-provider';

export function useAdministrator() {
  const { user } = useSession();
  const [state, setState] = useState<{ uid: string; allowed: boolean } | null>(null);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'administrators', user.uid), snap => setState({ uid:user.uid, allowed:snap.data()?.enabled === true }), () => setState({ uid:user.uid, allowed:false }));
  }, [user]);
  return { allowed:state?.uid === user?.uid && state?.allowed === true, loading:!!user && state?.uid !== user.uid };
}
export async function uploadGachaImage() {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes:['images'], quality:1 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  for (const edge of [768,512,384,256]) {
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width,asset.height)>edge) context.resize(asset.width>=asset.height?{width:edge}:{height:edge});
    const image = await context.renderAsync();
    const output = await image.saveAsync({format:SaveFormat.PNG,base64:true});
    context.release();image.release();
    const data=output.base64?`data:image/png;base64,${output.base64}`:'';
    if (!data || data.length>350000) continue;
    const file=doc(collection(db,'gachaImages'));
    const batch=writeBatch(db);
    batch.set(file,{data,createdAt:serverTimestamp()});
    await batch.commit();
    return {uri:`gacha-image:${file.id}`};
  }
  throw new Error('이미지 용량을 줄이지 못했어요. 다른 이미지를 선택해주세요.');
}
