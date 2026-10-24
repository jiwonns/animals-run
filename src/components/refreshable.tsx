import { forwardRef, isValidElement, type ComponentRef, type ForwardedRef, type ReactElement, type RefAttributes } from 'react';
import { FlatList as NativeFlatList, ScrollView as NativeScrollView, Platform, RefreshControl,
  type FlatListProps, type ScrollViewProps, type RefreshControlProps } from 'react-native';
import { useAppRefresh, useRefreshTask } from '@/lib/app-refresh';

type RefreshProps={horizontal?:boolean|null;refreshing?:boolean|null;onRefresh?:(()=>unknown)|null;refreshControl?:ReactElement};
function useRefreshControl(props:RefreshProps){
  const state=useAppRefresh();
  const existing=isValidElement<RefreshControlProps>(props.refreshControl)?props.refreshControl.props:undefined;
  useRefreshTask(props.horizontal?undefined:props.onRefresh??existing?.onRefresh);
  const refreshing=state.refreshing||!!props.refreshing||!!existing?.refreshing;
  return {refreshing,onRefresh:()=>void state.refresh(),refreshControl:props.horizontal||Platform.OS==='web'?props.refreshControl:
    <RefreshControl {...existing} refreshing={refreshing} onRefresh={()=>void state.refresh()}/>};
}
export type ScrollView=ComponentRef<typeof NativeScrollView>;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- Preserve native component/instance import compatibility.
export const ScrollView=forwardRef<ScrollView,ScrollViewProps & {onRefresh?:()=>unknown;refreshing?:boolean}>(function RefreshScrollView(props,ref){
  const refresh=useRefreshControl(props);
  return <NativeScrollView {...props} ref={ref} alwaysBounceVertical={props.horizontal?props.alwaysBounceVertical:true} refreshControl={refresh.refreshControl}/>;
});
export type FlatList<T>=NativeFlatList<T>;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- Preserve native component/instance import compatibility.
export const FlatList=forwardRef(function RefreshFlatList<T>(props:FlatListProps<T>,ref:ForwardedRef<NativeFlatList<T>>){
  const refresh=useRefreshControl(props);
  const {revision}=useAppRefresh();
  return <NativeFlatList {...props} ref={ref} {...(!props.horizontal?refresh:{})} extraData={[props.extraData,revision]}/>;
}) as <T>(props:FlatListProps<T>&RefAttributes<NativeFlatList<T>>)=>ReactElement;
