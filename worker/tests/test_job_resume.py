import json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from worker.historical_sources import Catalogs
from worker.mf_v3_worker import run_once

class JobResumeTests(unittest.TestCase):
 def test_journal_is_atomic_integrity_checked_and_bound_to_identity(self):
  with tempfile.TemporaryDirectory() as folder:
   c=Catalogs(Path(folder));jid='a'*24
   c.save_job(jid,'309328',['fifa'],[{'value':0}],{'fifa':{'status':'complete'}})
   self.assertEqual(c.load_job(jid,'309328',['fifa'])['candidates'],[{'value':0}])
   self.assertRaises(ValueError,c.load_job,jid,'743533',['fifa'])
   self.assertRaises(ValueError,c.load_job,'../escape','309328',['fifa'])
   path=c.base/'jobs'/(jid+'.json');saved=json.loads(path.read_text(encoding='utf-8'));saved['payload']['candidates'][0]['value']=99;path.write_text(json.dumps(saved),encoding='utf-8')
   self.assertRaises(ValueError,c.load_job,jid,'309328',['fifa'])
 def test_worker_resumes_saved_payload_without_repeating_collection(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);jid='b'*24;job={'id':jid,'claim_id':'lease','fotmob_player_id':'309328','sources':['fotmob'],'existing_stats':[]}
   records=[{'source_record_id':str(i),'value':i} for i in range(31)];staged=set();failed=[False];finishes=[]
   def remote(action,**body):
    if action=='claim':return {'job':job}
    if action=='submit':
     staged.update(c['source_record_id'] for c in body['candidates'])
     if not failed[0]:failed[0]=True;raise RuntimeError('Lost response after server accepted the batch')
    if action=='finish':finishes.append(body)
    return {'ok':True}
   with patch('worker.mf_v3_worker.call',side_effect=remote),patch('worker.mf_v3_worker.sync_reviews'),patch('worker.mf_v3_worker.collect',return_value=(records,{'fotmob':{'status':'complete'}})) as collect,patch('worker.mf_v3_worker.time.sleep'):
    self.assertRaises(RuntimeError,run_once,root)
    self.assertEqual(len(staged),15)
    self.assertTrue(run_once(root));self.assertEqual(len(staged),31);self.assertEqual(len(finishes),1);self.assertEqual(collect.call_count,1)

if __name__=='__main__':unittest.main()
