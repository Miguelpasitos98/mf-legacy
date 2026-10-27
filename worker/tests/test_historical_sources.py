import csv,io,json,sqlite3,tempfile,types,unittest,zipfile
from datetime import date
from pathlib import Path
from unittest.mock import patch
from worker.historical_sources import Catalogs,edition_for,season_close_value,provider_birth,norm,REGISTRY

class HistoricalSourceTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
 def tearDown(self):self.tmp.cleanup()
 def test_season_edition_is_explicit(self):
  self.assertEqual(edition_for('2022/2023'),(23,'FIFA 23'))
  self.assertEqual(edition_for('2023/2024'),(24,'FC 24'))
  for invalid in ['2023','2020/2022','2023/24']:self.assertRaises(ValueError,edition_for,invalid)
 def test_birth_comes_from_provider_not_fm_age(self):
  self.assertEqual(provider_birth({'birthDate':{'utcTime':'1995-02-11T00:00:00Z'}}),'1995-02-11')
  self.assertEqual(provider_birth({'date_of_birth':'11/02/1998'}),'')
 def test_market_is_latest_inside_season_not_current_transfer_price(self):
  rows=[{'date':'2023-06-30','market_value_in_eur':'90000000'},
        {'date':'2023-12-01','market_value_in_eur':'35000000'},
        {'date':'2024-06-03','market_value_in_eur':'30000000'},
        {'date':'2024-07-01','market_value_in_eur':'10000000'}]
  out=season_close_value(rows,'2023/2024',date(2026,10,27))
  self.assertEqual((out['value'],out['as_of_date']),(30000000,'2024-06-03'))
  self.assertIsNone(season_close_value(rows,'2025/2026',date(2026,10,27)))
 def test_market_zero_calendar_conflicts_and_provisional(self):
  rows=[{'date':'2024-02-30','market_value_in_eur':99},{'date':'2024-02-29','market_value_in_eur':0}]
  self.assertEqual(season_close_value(rows,'2023/2024',date(2024,3,1))['value'],0)
  self.assertTrue(season_close_value(rows,'2023/2024',date(2024,3,1))['provisional'])
  self.assertRaises(ValueError,season_close_value,[*rows,{'date':'2024-02-29','market_value_in_eur':1}],'2023/2024',date(2024,3,1))
 def test_archive_is_downloaded_once_and_integrity_checked(self):
  opener=unittest.mock.Mock(side_effect=lambda *a,**k:io.BytesIO(b'public archive'))
  c=Catalogs(self.root,network=True,opener=opener)
  p,sha=c.asset('understat-2014-2025');self.assertEqual(c.asset('understat-2014-2025'),(p,sha))
  self.assertEqual(opener.call_count,1)
  p.write_bytes(b'changed');self.assertRaises(ValueError,c.asset,'understat-2014-2025')
  self.assertEqual(opener.call_count,1)
 def test_connection_error_is_retryable_not_out_of_coverage(self):
  opener=unittest.mock.Mock(side_effect=TimeoutError('unavailable network'))
  c=Catalogs(self.root,network=True,opener=opener)
  self.assertRaises(TimeoutError,c.asset,'understat-2014-2025')
  self.assertRaises(RuntimeError,c.asset,'understat-2014-2025');self.assertEqual(opener.call_count,1)
  c.force=True;self.assertRaises(TimeoutError,c.asset,'understat-2014-2025');self.assertEqual(opener.call_count,2)
  with c.connect() as db:self.assertEqual(db.execute('SELECT status FROM resources').fetchone()[0],'temporary_error')
 def test_offline_never_fetches_even_with_force(self):
  opener=unittest.mock.Mock();c=Catalogs(self.root,network=False,force=True,opener=opener)
  self.assertRaises(RuntimeError,c.asset,'fifa-launch-15-24');opener.assert_not_called()
 def test_identity_mapping_never_changes_or_duplicates(self):
  c=Catalogs(self.root);c.identity('1','fifa','10',{'rule':'verified'})
  c.identity('1','fifa','10',{'rule':'same'})
  self.assertRaises(ValueError,c.identity,'1','fifa','11',{})
  self.assertRaises(ValueError,c.identity,'2','fifa','10',{})
 def test_saved_state_requires_all_candidates_reviewed(self):
  c=Catalogs(self.root);c.state('1','fifa','2023/2024','pendiente_verificacion',edition='FC 24',snapshot='sha')
  c.track_job('job','1');c.apply_review_status('job','1',[{'source':'fifa','season':'2023/2024','pending':1,'applied':1,'rejected':0}])
  self.assertFalse(c.saved('1','fifa','2023/2024'))
  c.apply_review_status('job','1',[{'source':'fifa','season':'2023/2024','pending':0,'applied':1,'rejected':0}],True)
  self.assertTrue(Catalogs(self.root).saved('1','fifa','2023/2024'));self.assertEqual(c.pending_jobs(),[])
 def fifa_fixture(self,rows):
  target=self.root/'ratings.zip'
  body=io.StringIO();w=csv.DictWriter(body,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
  with zipfile.ZipFile(target,'w') as z:z.writestr('male_players.csv',body.getvalue())
  return target
 def test_launch_snapshot_and_primary_position_not_potential_or_game_value(self):
  base={'player_id':'10','long_name':'Milan Skriniar','dob':'1995-02-11','club_name':'Inter','fifa_version':'23','fifa_update':'2','update_as_of':'2022-09-26','overall':'86','potential':'99','value_eur':'9999999','player_positions':'CB, CDM','player_url':'/player/10/test/230002'}
  rows=[base,{**base,'update_as_of':'2023-01-13','overall':'85','fifa_update':'9'}]
  target=self.fifa_fixture(rows);c=Catalogs(self.root)
  app=types.ModuleType('app');app.__path__=[];bridge=types.ModuleType('app.understat_bridge');bridge.same_team=lambda a,b:norm(a)==norm(b)
  bundle={'player':{'name':'Milan Skriniar'},'career':[{'team_name':'Inter'}]};raw={'birthDate':{'utcTime':'1995-02-11T00:00:00Z'}}
  with patch.dict('sys.modules',{'app':app,'app.understat_bridge':bridge}),patch.object(c,'asset',return_value=(target,'sha')):
   result=c.fifa('123',bundle,raw,['2022/2023','2026/2027'])
  self.assertEqual(len(result),1);self.assertEqual(result[0]['value'],86);self.assertEqual(result[0]['fifa_fc_position'],'CB')
  self.assertEqual(result[0]['provenance']['revision_date'],'2022-09-26');self.assertNotIn('value_eur',result[0])
  self.assertEqual(c.diagnostics('123','fifa')[0]['state'],'consulta_pendiente')
 def test_registry_never_calls_protected_sites(self):
  for url,_,_ in REGISTRY.values():
   self.assertNotIn('://understat.com',url);self.assertNotIn('://sofifa.com',url);self.assertNotIn('://www.transfermarkt.com',url)
 def test_fc26_raw_csv_reuses_confirmed_identity_after_transfer(self):
  row={'player_id':'10','long_name':'Milan Skriniar','dob':'1995-02-11','club_name':'Fenerbahce SK','fifa_version':'26','fifa_update':'4','update_as_of':'2025-09-19','overall':'81','player_positions':'CB, CDM','player_url':'/player/10/test/260004'}
  target=self.root/'fc26.csv';body=io.StringIO();writer=csv.DictWriter(body,fieldnames=list(row));writer.writeheader();writer.writerow(row);target.write_text(body.getvalue(),encoding='utf-8')
  c=Catalogs(self.root);c.identity('123','fifa','10',{'dob':row['dob']})
  app=types.ModuleType('app');app.__path__=[];bridge=types.ModuleType('app.understat_bridge');bridge.same_team=lambda a,b:norm(a)==norm(b)
  bundle={'player':{'name':'Milan Skriniar'},'career':[{'team_name':'Inter'}]}
  with patch.dict('sys.modules',{'app':app,'app.understat_bridge':bridge}),patch.object(c,'asset',return_value=(target,'sha')):
   result=c.fifa('123',bundle,{'birthDate':{'utcTime':row['dob']}},['2025/2026'])
  self.assertEqual((result[0]['value'],result[0]['fifa_fc_position']),(81,'CB'));self.assertEqual(result[0]['provenance']['archive_version'],'3')
 def test_diagnostics_latest_revision_and_saved_has_priority(self):
  c=Catalogs(self.root);c.state('123','fifa','2025/2026','consulta_pendiente',edition='FC 26')
  c.state('123','fifa','2025/2026','verificado_guardado',edition='FC 26',snapshot='saved')
  c.state('123','fifa','2025/2026','pendiente_verificacion',edition='FC 26',snapshot='new')
  result=c.diagnostics('123','fifa');self.assertEqual(len(result),1);self.assertEqual(result[0]['state'],'verificado_guardado')
 def test_review_sync_rotates_past_unfinished_jobs(self):
  c=Catalogs(self.root)
  for n in range(4):c.track_job(str(n),'123')
  first=c.pending_jobs();self.assertEqual(len(first),3)
  for job in first:c.apply_review_status(job['job_id'],'123',[])
  self.assertEqual(c.pending_jobs()[0]['job_id'],'3')
 def test_review_sync_prioritizes_the_player_before_repeating_collection(self):
  c=Catalogs(self.root)
  for i in range(5):c.track_job(str(i),'other-player')
  c.track_job('latest','743533')
  self.assertEqual([r['job_id'] for r in c.pending_jobs('743533')],['latest'])

if __name__=='__main__':unittest.main()
