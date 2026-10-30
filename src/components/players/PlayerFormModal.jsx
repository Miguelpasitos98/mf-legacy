import React from "react";
import { X } from "lucide-react";
import {
  inputClassName,
  POSITION_RATING_GROUPS,
  PLAYER_DESCRIPTIONS,
  NEW_TEAM_VALUE,
  NEW_COUNTRY_VALUE,
  careerStatusLogo,
  normalizeImageUrl,
  SearchableEntitySelect,
} from "@/components/players/playerFormShared";

/**
 * PlayerFormModal — modal de creación de jugadores.
 *
 * Extraído de Players.jsx como componente de presentación.
 * El estado del formulario (`form`/`setForm`), `isSaving`, y los
 * handlers de guardado/cierre se controlan desde Players.jsx mediante props.
 */
export default function PlayerFormModal({
  form,
  setForm,
  isSaving,
  onClose,
  onSubmit,
  countries,
  teams,
}) {
  return (
    <div
      className="mf-modal-overlay fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="mf-modal-panel max-h-[calc(100dvh_-_32px)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">

        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Add player
            </h2>

            <p className="mt-0.5 text-xs text-slate-400">
              Create a new player in the database.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-5 p-5"
        >

          {/* PLAYER NAME */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Player name
            </label>

            <input
              type="text"
              value={form.name}
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    name:
                      event.target
                        .value,
                  })
                )
              }
              placeholder="e.g. Neymar Jr"
              className={
                inputClassName
              }
              required
            />
          </div>

          {/* DATE OF BIRTH */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Date of birth
            </label>

            <input
              type="text"
              value={
                form.dateOfBirth
              }
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    dateOfBirth:
                      event.target
                        .value,
                  })
                )
              }
              placeholder="5/2/1999 o 05/02/1999"
              inputMode="numeric"
              maxLength={10}
              className={
                inputClassName
              }
            />

            <p className="mt-1.5 text-[11px] text-slate-400">
              Format: DD/MM/YYYY
            </p>
          </div>

          {/* COUNTRY */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Country
            </label>

            <SearchableEntitySelect
              value={form.countryId}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  countryId: value,
                  newCountryName: "",
                }))
              }
              options={countries}
              kind="country"
              placeholder="Select country"
              searchPlaceholder="Search country..."
              emptyOption={{
                value: "",
                label: "Select country",
              }}
              specialOption={{
                value: NEW_COUNTRY_VALUE,
                label: "New country",
              }}
            />

            {form.countryId ===
              NEW_COUNTRY_VALUE && (
              <div className="mt-3 rounded-xl border border-[#003399]/15 bg-[#003399]/[0.035] p-4">

                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  New country
                </label>

                <input
                  type="text"
                  value={
                    form.newCountryName
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        newCountryName:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="e.g. Argentina"
                  className={
                    inputClassName
                  }
                  autoFocus
                />

                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  The country will be created
                  automatically when you save
                  the player. Its 3-letter code
                  will be generated automatically.
                </p>
              </div>
            )}

            {countries.length ===
              0 && (
              <p className="mt-1.5 text-[11px] text-slate-400">
                No countries have
                been created yet.
              </p>
            )}
          </div>

          {/* CLUB */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Associated club
            </label>

            <SearchableEntitySelect
              value={form.teamId}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  teamId: value,
                  newTeamName: "",
                }))
              }
              options={[{id:"__free_agent__",name:"Agente libre",logo:careerStatusLogo("free_agent"),short_name:"LIB"},{id:"__retired__",name:"Retirado",logo:careerStatusLogo("retired"),short_name:"RET"},...teams]}
              kind="team"
              placeholder="No club"
              searchPlaceholder="Search club..."
              emptyOption={{
                value: "",
                label: "No club",
              }}
              specialOption={{
                value: NEW_TEAM_VALUE,
                label: "+ Create new club",
              }}
            />
          </div>

          {["__free_agent__","__retired__"].includes(form.teamId) && <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3"><label className="mb-1 block text-xs font-semibold text-slate-700">Último club (opcional)</label><select className="w-full rounded-xl border border-slate-200 p-2 text-sm" value={form.lastTeamId} onChange={e=>setForm(f=>({...f,lastTeamId:e.target.value}))}><option value="">Sin último club</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>{form.teamId === "__retired__" && <label className="mt-3 block text-xs font-semibold text-slate-700">Año de retirada<input type="number" min="1900" max="2100" className="mt-1 w-full rounded-xl border border-slate-200 p-2" value={form.retirementYear} onChange={e=>setForm(f=>({...f,retirementYear:e.target.value}))}/></label>}</div>}

          {/* NEW CLUB */}
          {form.teamId ===
            NEW_TEAM_VALUE && (
            <div className="rounded-xl border border-[#003399]/15 bg-[#003399]/[0.035] p-4">

              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                New club
              </label>

              <input
                type="text"
                value={
                  form.newTeamName
                }
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,
                      newTeamName:
                        event.target.value,
                    })
                  )
                }
                placeholder="e.g. Santos FC"
                className={
                  inputClassName
                }
                autoFocus
              />

              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                The club will be
                created automatically
                when you save the player.
                The selected country will be
                assigned to the new club.
              </p>

            </div>
          )}

          {/* CA / CP */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Ratings
              </label>
              <span className="text-[11px] text-slate-400">
                CA / CP: 0-200
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  CA
                </label>
                <input
                  type="number"
                  min={0}
                  max={200}
                  step={1}
                  value={form.ca}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      ca: event.target.value,
                    }))
                  }
                  placeholder="e.g. 185"
                  className={inputClassName}
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  CP
                </label>
                <input
                  type="number"
                  min={0}
                  max={200}
                  step={1}
                  value={form.cp}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      cp: event.target.value,
                    }))
                  }
                  placeholder="e.g. 195"
                  className={inputClassName}
                  required
                />
              </div>
            </div>
          </div>

          {/* POSITION RATINGS */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Position ratings
                </label>
                <p className="mt-1 text-[11px] text-slate-400">
                  Valora cada posición de 0 a 20. Un jugador puede tener distintas valoraciones.
                </p>
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                0-20
              </span>
            </div>

            <div className="space-y-4">
              {POSITION_RATING_GROUPS.map((group) => (
                <div key={group.title}>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    {group.title}
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {group.positions.map(([code, label]) => (
                      <div key={code}>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                          {label}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          step={1}
                          value={
                            form.positionRatings?.[code] ??
                            "0"
                          }
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              positionRatings: {
                                ...current.positionRatings,
                                [code]: event.target.value,
                              },
                            }))
                          }
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DESCRIPTION */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Description
              </label>
              <span className="text-[11px] text-slate-400">
                Selecciona el perfil del jugador
              </span>
            </div>

            <select
              value={form.description || ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              className={inputClassName}
            >
              <option value="">Sin descripción</option>

              {PLAYER_DESCRIPTIONS.map((group) => (
                <optgroup
                  key={group.group}
                  label={group.group}
                >
                  {group.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <p className="mt-1.5 text-[11px] text-slate-400">
              La descripción podrá utilizarse después como perfil
              automático basado en edad, CA, CP y posiciones.
            </p>
          </div>

          {/* PLAYER PHOTO */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Player photo URL
            </label>

            <input
              type="url"
              value={
                form.photoUrl
              }
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    photoUrl:
                      event.target
                        .value,
                  })
                )
              }
              placeholder="https://..."
              className={
                inputClassName
              }
            />
          </div>

          {/* PLAYER CARD PHOTO */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Player card photo URL
            </label>

            <input
              type="url"
              value={form.cardPhotoUrl}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  cardPhotoUrl: event.target.value,
                }))
              }
              placeholder="https://..."
              className={inputClassName}
            />

            <p className="mt-1.5 text-[11px] text-slate-400">
              Imagen utilizada exclusivamente en las tarjetas del listado de jugadores.
            </p>
          </div>

          {/* NATIONAL TEAM CARD PHOTO */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              National team card photo URL
            </label>

            <input
              type="url"
              value={form.nationalCardPhotoUrl}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  nationalCardPhotoUrl: event.target.value,
                }))
              }
              placeholder="https://..."
              className={inputClassName}
            />

            <p className="mt-1.5 text-[11px] text-slate-400">
              Imagen utilizada en la agrupación por países, idealmente con la camiseta de la selección.
            </p>
          </div>

          {/* PHOTO PREVIEW */}
          {form.photoUrl && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">

              <img
                src={normalizeImageUrl(
                  form.photoUrl
                )}
                alt=""
                className="h-16 w-16 rounded-lg object-cover object-top"
                onError={(event) => {
                  event.currentTarget.style.display =
                    "none";
                }}
              />

              <div className="text-xs text-slate-500">
                Preview of the player photo.
              </div>

            </div>
          )}

          {/* CARD PHOTO PREVIEW */}
          {form.cardPhotoUrl && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <img
                src={normalizeImageUrl(form.cardPhotoUrl)}
                alt=""
                className="h-16 w-16 rounded-lg object-cover object-top"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />

              <div className="text-xs text-slate-500">
                Preview of the player card photo.
              </div>
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">

            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                isSaving ||
                !form.name.trim() ||
                form.ca === "" ||
                form.cp === "" ||
                ((form.teamId ===
                  NEW_TEAM_VALUE &&
                  !form.newTeamName.trim()) ||
                (form.countryId ===
                  NEW_COUNTRY_VALUE &&
                  !form.newCountryName.trim()))
              }
              className="h-10 rounded-xl bg-[#003399] px-4 text-sm font-semibold text-white transition hover:bg-[#002477] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving
                ? "Saving..."
                : "Create player"}
            </button>

          </div>
        </form>
      </div>
    </div>
  );
}