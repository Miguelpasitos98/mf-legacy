// STADIUMS: single mapping shared by gallery and detail pages.
export const rows=data=>Array.isArray(data)?data:(data?.items||data?.data||data?.entities||[]);
export const safe=value=>String(value??"").trim();
export const digits=value=>value===null||value===undefined||value===""?"":String(value);

export function toStadiums(teams,countries,leagues){
  const byCountry=new Map(countries.map(country=>[String(country.id||country._id),country]));
  const byLeague=new Map(leagues.map(league=>[String(league.id||league._id),league]));
  const grouped=new Map();
  for(const team of teams){
    const name=safe(team.stadium||team.stadiumName);
    if(!name)continue;
    const countryId=safe(team.country_id||team.countryId);
    const league=byLeague.get(safe(team.league_id||team.leagueId));
    const country=byCountry.get(countryId||safe(league?.country_id||league?.countryId));
    const countryName=safe(team.country||team.country_name||team.countryName||country?.name);
    const leagueName=safe(league?.name||team.competition);
    const key=safe(team.stadium_id||team.stadiumId)
      ? "id:"+safe(team.stadium_id||team.stadiumId)
      : "name:"+name.toLocaleLowerCase("es")+"|"+(countryId||countryName.toLocaleLowerCase("es"));
    const details={
      name,city:safe(team.city),country:countryName,competition:leagueName,
      capacity:team.stadium_capacity??team.stadiumCapacity??null,
      built:team.stadium_built_year??team.stadiumBuiltYear??null,
      renovated:team.stadium_renovation??team.stadiumRenovation??null,
      pitch:safe(team.pitch_dimensions||team.pitchDimensions),
      interior:safe(team.stadium_interior_url||team.stadiumInteriorUrl),
      exterior:safe(team.stadium_exterior_url||team.stadiumExteriorUrl),
      description:safe(team.stadium_description||team.stadiumDescription),
    };
    if(!grouped.has(key))grouped.set(key,{id:key,teams:[],...details});
    const stadium=grouped.get(key);
    stadium.teams.push(team);
    for(const field of ["city","country","competition","capacity","built","renovated","pitch","interior","exterior","description"]){
      if(!stadium[field]&&details[field])stadium[field]=details[field];
    }
  }
  return [...grouped.values()];
}
