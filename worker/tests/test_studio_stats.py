"""Offline regressions against the existing Studio installation (optional in CI)."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from worker.mf_v3_worker import studio_import, studio_fotmob, metric_values, collect

ROOT=Path(os.environ.get('MF_STUDIO_ROOT',''))


class UnitsTests(unittest.TestCase):
    def test_percent_format_without_percent_in_title(self):
        self.assertEqual(list(metric_values({'name':'Pass accuracy','value':88.4,
            'per90':88.43,'stat_format':'percent'})), [('percentage',88.4)])

    def test_explicit_rate_never_becomes_total(self):
        self.assertEqual(list(metric_values({'name':'Tackles /90','value':2.4,'per90':2.4})), [('per90',2.4)])
        self.assertEqual(list(metric_values({'name':'Shots per match','value':1.2,'per90':1.4})), [('per_match',1.2)])

    def test_summary_per90_is_not_a_rate(self):
        self.assertEqual(list(metric_values({'name':'Minutes','value':540,'per90':90})), [('total',540)])
        self.assertEqual(list(metric_values({'name':'Rating','value':7.1,'per90':7.123})), [('total',7.1)])

    def test_totals_rates_and_zero_remain_distinct(self):
        self.assertEqual(list(metric_values({'name':'Goals','value':0,'per90':0})), [('total',0),('per90',0)])
        self.assertEqual(list(metric_values({'name':'Clearances','value':30,'per90':4.2})), [('total',30),('per90',4.2)])

    def test_signed_keeper_metric_is_preserved(self):
        self.assertEqual(list(metric_values({'name':'Goals prevented','value':-.39,'per90':-.13})), [('total',-.39),('per90',-.13)])
        self.assertEqual(list(metric_values({'name':'Goals','value':-1,'per90':-1})), [])


@unittest.skipUnless((ROOT/'app/profile.py').exists(),'Set MF_STUDIO_ROOT for Studio integration')
class StudioTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.profile,cls.client,cls.resolver=studio_import(ROOT)

    def bundle(self):
        payload={'id':309328,'name':'Milan Škriniar','careerHistory':{'careerItems':{
            'senior':{'seasonEntries':[
                {'seasonName':'2024/2025','teamId':8695,'team':'Fenerbahçe','appearances':23,
                 'tournamentStats':[{'seasonName':'2024/2025','leagueId':71,'leagueName':'Süper Lig','tournamentId':23864,'appearances':16}]},
                {'seasonName':'2024/2025','teamId':9847,'team':'PSG','appearances':5,
                 'tournamentStats':[{'seasonName':'2024/2025','leagueId':53,'leagueName':'Ligue 1','tournamentId':23724,'appearances':5}]}]},
            'national team':{'seasonEntries':[{'seasonName':'2024/2025','teamId':8497,'team':'Slovakia','appearances':4,
                 'tournamentStats':[{'seasonName':'2024/2025','leagueId':50,'leagueName':'EURO','appearances':4}]}]}}}}
        return {'player':self.profile.profile_identity(payload),'career':self.profile.extract_career(payload)}

    def detail(self,comp='Super Lig',tid='71'):
        return {'fotmob_player_id':'309328','season':'2024/2025','competition':comp,
                'fotmob_tournament_id':tid,'profile_season_id':'2-0'}

    def test_career_keeps_official_league_id_and_national_branch(self):
        career=self.bundle()['career']
        self.assertTrue(any(c['fotmob_tournament_id']=='71' and not c['is_national_team'] for c in career))
        self.assertTrue(any(c['fotmob_team_id']=='8497' and c['is_national_team'] for c in career))
        self.assertFalse(any(c['fotmob_tournament_id']=='23864' for c in career))
        self.assertFalse(any(c.get('conflict_note') for c in career))

    def test_same_season_different_leagues_resolve_different_clubs(self):
        b=self.bundle()
        self.assertEqual(self.resolver.resolve_stats_team(self.detail(),b,{}, {})[0],'8695')
        self.assertEqual(self.resolver.resolve_stats_team(self.detail('Ligue 1','53'),b,{}, {})[0],'9847')

    def test_shot_of_other_player_is_not_evidence(self):
        result=self.resolver.resolve_stats_team(self.detail('Super Cup','166'),self.bundle(),
            {'shotmap':[{'playerId':999,'teamId':9847}]},{})
        self.assertEqual(result[0],'')

    def test_multi_club_tournament_not_split_by_one_shot(self):
        b=self.bundle()
        b['career'].append({**next(c for c in b['career'] if c['fotmob_tournament_id']=='71'), 'fotmob_team_id':'9847','team_name':'PSG'})
        result=self.resolver.resolve_stats_team(self.detail(),b,{'shotmap':[{'playerId':309328,'teamId':8695}]},{})
        self.assertEqual(result[0],'')
        self.assertEqual(result[2],'multiple_teams_in_tournament')

    def test_euro_is_national_and_does_not_inherit_club(self):
        self.assertEqual(self.resolver.resolve_stats_team(self.detail('EURO','50'),self.bundle(),{}, {})[0],'8497')
        b=self.bundle();b['career']=[c for c in b['career'] if not c['is_national_team']]
        self.assertEqual(self.resolver.resolve_stats_team(self.detail('EURO','50'),b,{}, {})[0],'')

    def test_entry_id_is_not_recomputed_from_array_position(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'profile.json'
            p.write_text(json.dumps({'id':309328,'statSeasons':[{'seasonName':'2024/2025',
                'tournaments':[{'name':'Ligue 1','tournamentId':53,'entryId':'9-4'}]}]}),encoding='utf-8')
            self.assertEqual(self.profile.load_profile_bundle(p)['season_options'][0]['season_id'],'9-4')

    def test_real_skriniar_is_offline_reproducible_and_keeps_pending(self):
        if not self.client.player_cache_path(ROOT,'309328').exists():self.skipTest('No Skriniar cache')
        with patch.object(self.client,'fetch_profile',side_effect=AssertionError('Network forbidden')), patch.object(self.client,'fetch_stats',side_effect=AssertionError('Network forbidden')):
            a,state=studio_fotmob(ROOT,'309328')
            b,_=studio_fotmob(ROOT,'309328')
        self.assertEqual(a,b)
        self.assertGreater(len(a),500)
        self.assertEqual(len({r['source_record_id'] for r in a}),len(a))
        self.assertEqual(state['network_requests'],0)
        self.assertFalse(any(r['fotmob_team_id']=='8636' for r in a))
        self.assertFalse(any(r['competition']=='Super Cup' for r in a))
        self.assertTrue(any(r['metric_name']=='Pass accuracy' and r['metric_unit']=='percentage' for r in a))
        self.assertFalse(any(r['metric_name']=='Rating' and r['metric_unit']=='per90' for r in a))

    def test_cache_reorder_and_failed_requests_are_bounded(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            f=self.client.player_cache_path(root,'309328');f.parent.mkdir(parents=True)
            f.write_text(json.dumps({'id':309328,'statSeasons':[{'seasonName':'2024/2025','tournaments':[
                {'name':'Super Lig','tournamentId':71,'entryId':'2-0'},
                {'name':'Ligue 1','tournamentId':53,'entryId':'2-1'}]}]}),encoding='utf-8')
            cache=self.client.stat_cache_path(root,'309328','2-0');cache.parent.mkdir(parents=True)
            cache.write_text(json.dumps({'_mf_legacy_meta':{'player_id':'309328','season':'2023/2024','competition':'Super Lig','season_id':'2-0'},'payload':{}}),encoding='utf-8')
            with patch('worker.mf_v3_worker.studio_import',return_value=(self.profile,self.client,self.resolver)), patch.object(self.client,'fetch_stats',side_effect=OSError('Provider unavailable')) as fetch:
                records,state=studio_fotmob(root,'309328',allow_network=True,request_limit=1)
            self.assertEqual(records,[]);self.assertEqual(fetch.call_count,1)
            self.assertEqual(state['counts']['incompatible_response'],2)

    def test_collect_offline_overrides_network_environment(self):
        with patch.dict(os.environ,{'MF_V3_ALLOW_FOTMOB_NETWORK':'1'}), patch('worker.mf_v3_worker.studio_fotmob',return_value=([],{})) as fetch:
            collect(ROOT,'309328',['fotmob'],offline=True)
            self.assertFalse(fetch.call_args.kwargs['allow_network'])
