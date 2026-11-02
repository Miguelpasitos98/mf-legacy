import {useQuery} from '@tanstack/react-query';
import {IDENTITY_KEY,readIdentityViews,useIdentityChanges} from '@/hooks/useIdentityCatalog';
export default function useImportPlayerIdentity(player){
 useIdentityChanges();
 return useQuery({queryKey:[...IDENTITY_KEY,'import-player',player?.id||'',String(player?.fm26_uid||'')],
  enabled:!!player?.id,staleTime:0,refetchInterval:15000,refetchOnWindowFocus:true,retry:false,
  queryFn:async()=>{const view=(await readIdentityViews([player]))[0];return view;}});
}

