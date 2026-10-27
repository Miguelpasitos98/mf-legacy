import copy,hashlib,io,json,tempfile,unittest
from pathlib import Path
from unittest.mock import Mock
from worker.crafted_source import decode_profile,profile_asset,season_candidates
from worker.historical_sources import Catalogs

def html(profile):
    flat=[]
    def add(v):
        i=len(flat);flat.append(None)
        if isinstance(v,dict):flat[i]={k:add(x) for k,x in v.items()}
        elif isinstance(v,list):flat[i]=[add(x) for x in v]
        else:flat[i]=v
        return i
    add({'data':{'public':profile}})
    return '<script type="application/json" id="__NUXT_DATA__">'+json.dumps(flat)+'</script>'

class CraftedTests(unittest.TestCase):
    def setUp(self):
        self.row={'player_id':123,'team_id':1,'team_name':'Club','comp_code':'ESP-LaLiga','season':'2025/2026','us_matched':True,'us_xGChain90':.6203,'us_xGBuildup90':.4981,'us_xGChain':19.05,'us_xGBuildup':15.3,'minutes':2746,'matches_played':33,'sofifa_overall':87,'transfer_value_eur':112427741}
        self.profile={'player_id':123,'metadata':{'player_id':123,'player_name':'Player','date_of_birth':'1998-07-22'},'season_rows':[{**self.row,'season':'2023/2024','us_xGChain':27.96735,'us_xGBuildup':20.86658},self.row]}
        self.bundle={'player':{'name':'Player'},'career':[{'season':s,'fotmob_team_id':'1','team_name':'Club','fotmob_tournament_id':'87'} for s in ['2023/2024','2025/2026']],'season_options':[{'season':s,'tournament_id':'87','competition':'LaLiga'} for s in ['2023/2024','2025/2026']]}
        self.raw={'birthDate':{'utcTime':'1998-07-22T00:00:00Z'}}
        self.primary=[{'season':'2023/2024','fotmob_team_id':'1','fotmob_tournament_id':'87','verification_status':'verified','metric_name':n,'metric_unit':'total','value':v} for n,v in [('xG Chain',27.96735),('xG Buildup',20.86658)]]
        self.meta={'url':'https://craftedfc.com/player-ratings/player','sha256':'a'*64,'checked_at':'2026-10-27T00:00:00+00:00'}
    def candidates(self,**kw):return season_candidates(self.profile,'123',self.bundle,self.raw,self.primary,self.meta,**kw)
    def test_safe_ssr_roundtrip_and_reject_corruption(self):
        self.assertEqual(decode_profile(html(self.profile)),self.profile)
        for bad in ['<script>alert(1)</script>','<script id="__NUXT_DATA__">[{"data":999}]</script>','<script id="__NUXT_DATA__">[{"data":0}]</script>']:self.assertRaises(ValueError,decode_profile,bad)
    def test_recent_rates_are_published_no_invented_minutes_or_current_values(self):
        result=self.candidates(existing_scopes=[])
        self.assertEqual([c['metric_name'] for c in result],['xG Chain /90','xG Buildup /90','Minutes','Matches'])
        self.assertEqual([c['value'] for c in result],[.6203,.4981,2746,33])
        self.assertTrue(all(c['verification_status']=='verified' for c in result))
        self.assertTrue(all('provider_minutes' not in c['provenance'] for c in result))
        self.assertEqual(result[2]['provenance']['provider'],'craftedfc_match_context')
        self.assertEqual(self.candidates(seasons=['2023/2024']),[])
    def test_wrong_identity_scope_cups_and_impossible_rates_rejected(self):
        self.profile['player_id']=999;self.assertRaises(ValueError,self.candidates)
        self.profile['player_id']=123;self.profile['metadata']['date_of_birth']='1990-01-01';self.assertRaises(ValueError,self.candidates)
        self.profile['metadata']['date_of_birth']='1998-07-22'
        for change in [{'team_id':9},{'comp_code':'ChampionsLeague'},{'us_matched':False},{'us_xGBuildup90':99}]:
            self.profile['season_rows'][1]={**self.row,**change};self.assertEqual(self.candidates(),[])
    def test_no_upstream_corroboration_requires_individual_review(self):
        self.primary=[]
        self.assertTrue(all(c['verification_status']=='unverified' for c in self.candidates()))
    def test_cache_checksum_offline_and_network_cooldown(self):
        with tempfile.TemporaryDirectory() as root:
            opener=Mock(side_effect=lambda *a,**k:io.BytesIO(html(self.profile).encode()))
            catalog=Catalogs(root,network=True,opener=opener)
            page,meta=profile_asset(catalog,'123','Player')
            self.assertEqual(meta['sha256'],hashlib.sha256(page).hexdigest())
            self.assertEqual(profile_asset(catalog,'123','Player')[0],page);self.assertEqual(opener.call_count,1)
            catalog.network=False;self.assertEqual(profile_asset(catalog,'123','Player')[0],page)
            (catalog.base/'crafted-profile-123.html').write_bytes(b'changed');self.assertRaises(ValueError,profile_asset,catalog,'123','Player')
        with tempfile.TemporaryDirectory() as root:
            opener=Mock(side_effect=TimeoutError('timeout'));catalog=Catalogs(root,network=True,opener=opener)
            self.assertRaises(TimeoutError,profile_asset,catalog,'123','Player')
            self.assertRaises(RuntimeError,profile_asset,catalog,'123','Player');self.assertEqual(opener.call_count,1)
