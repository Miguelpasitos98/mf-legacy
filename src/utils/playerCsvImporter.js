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
                    onClick={
                      handleCloseAddPlayer
                    }
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
        )}
      </div>
    </div>
  );
}
