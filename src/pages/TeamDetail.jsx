
function TeamDetail({ team, onClose }) {
  const primaryColor =
    team.primary_color ||
    team.primaryColor ||
    "#151515";

  const secondaryColor =
    team.secondary_color ||
    team.secondaryColor ||
    "#E7EBEF";

  const primaryTextColor =
    team.primary_text_color ||
    "#FFFFFF";

  const secondaryTextColor =
    team.secondary_text_color ||
    "#151515";

  const teamName =
    team.name ||
    "Football Club";

  const shortName =
    team.short_name ||
    team.shortName ||
    "";

  const country =
    team.country ||
    "";

  const city =
    team.city ||
    "";

  const foundedYear =
    team.founded_year ||
    team.foundedYear ||
    team.yearFounded ||
    "";

  const stadium =
    team.stadium ||
    "";

  const stadiumCapacity =
    team.stadium_capacity ||
    "";

  const ranking =
    team.team_ranking ||
    "";

  const motto =
    team.motto ||
    "";

  const kitUrl =
    team.kit1_photo_url ||
    team.kit1PhotoUrl ||
    "";

  const countryOutlineUrl =
    team.country_outline_url ||
    team.countryOutlineUrl ||
    "";

  const condensedFont = {
    fontFamily:
      '"Arial Narrow", "Roboto Condensed", "Arial Narrow", Impact, sans-serif',
  };

  return (
    <div
      className="relative min-h-full overflow-hidden p-0"
      style={{
        backgroundColor: primaryColor,
      }}
    >
      {/* =====================================================
          FONDO GENERAL
      ====================================================== */}

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(
              ellipse at 20% 40%,
              rgba(255,255,255,0.06),
              transparent 55%
            ),
            linear-gradient(
              135deg,
              ${primaryColor},
              ${primaryColor} 45%,
              ${secondaryColor} 45%,
              ${secondaryColor}
            )
          `,
        }}
      />

      {/* =====================================================
          PANEL PRINCIPAL
      ====================================================== */}

      <div className="relative min-h-screen overflow-hidden">
        {/* División diagonal principal */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundColor: secondaryColor,
            clipPath:
              "polygon(54% 0%, 100% 0%, 100% 100%, 44% 100%)",
          }}
        />

        {/* Franja clara de transición */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundColor: "#FFFFFF",
            clipPath:
              "polygon(51% 0%, 54% 0%, 44% 100%, 41% 100%)",
          }}
        />

        {/* Textura suave del fondo */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(135deg, transparent 0%, #FFFFFF 50%, transparent 100%)",
          }}
        />

        {/* =====================================================
            CABECERA
        ====================================================== */}

        <div className="relative z-40 flex items-center justify-between px-6 py-6 md:px-10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/40 bg-black/20 px-5 py-2.5 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-black/40"
          >
            ← Volver a equipos
          </button>

          <div className="flex items-center gap-6">
            <span
              className="hidden text-[10px] font-bold uppercase tracking-[0.35em] md:block"
              style={{
                color: secondaryTextColor,
              }}
            >
              Team profile
            </span>

            <span
              className="text-[10px] font-bold uppercase tracking-[0.3em]"
              style={{
                color: secondaryTextColor,
              }}
            >
              MF Legacy
            </span>
          </div>
        </div>

        {/* =====================================================
            PANEL INTERIOR
        ====================================================== */}

        <div className="relative z-10 mx-6 mb-6 overflow-hidden rounded-2xl border border-white/20 md:mx-10">
          {/* ===================================================
              MARCA DE AGUA TIPOGRÁFICA
          ==================================================== */}

          <div
            className="pointer-events-none absolute bottom-[15%] left-[-30px] z-0 select-none whitespace-nowrap text-[110px] font-black uppercase leading-none tracking-[-0.09em] opacity-[0.09] md:text-[190px]"
            style={{
              ...condensedFont,
              color: secondaryTextColor,
            }}
          >
            {teamName}
          </div>

          {/* ===================================================
              CONTORNO DEL PAÍS
          ==================================================== */}

          {countryOutlineUrl && (
            <img
              src={countryOutlineUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute right-[-100px] top-1/2 z-0 h-[440px] w-[440px] -translate-y-1/2 object-contain opacity-[0.09] blur-[1px] md:h-[620px] md:w-[620px]"
              style={{
                filter: "grayscale(1)",
              }}
            />
          )}

          <div className="relative z-10 grid min-h-[720px] grid-cols-1 md:grid-cols-[1.05fr_0.95fr]">
            {/* =================================================
                COLUMNA IZQUIERDA
            ================================================== */}

            <div className="relative flex flex-col justify-between p-8 md:p-14">
              <div>
                {/* Lema */}
                <div className="mb-10 flex items-center gap-4">
                  <div
                    className="h-1 w-12"
                    style={{
                      backgroundColor: secondaryTextColor,
                    }}
                  />

                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.4em]"
                    style={{
                      color: secondaryTextColor,
                    }}
                  >
                    Más que un club
                  </span>
                </div>

                {/* Nombre corto */}
                <p
                  className="mb-5 text-xs font-bold uppercase tracking-[0.4em]"
                  style={{
                    color: secondaryTextColor,
                    opacity: 0.65,
                  }}
                >
                  {shortName || "Football Club"}
                </p>

                {/* Nombre principal */}
                <h1
                  className="relative max-w-[650px] text-6xl font-black uppercase leading-[0.8] tracking-[-0.075em] md:text-8xl lg:text-[112px]"
                  style={{
                    ...condensedFont,
                    color: primaryTextColor,
                  }}
                >
                  {teamName}
                </h1>

                <p
                  className="mt-10 text-[10px] font-bold uppercase tracking-[0.45em]"
                  style={{
                    color: secondaryTextColor,
                    opacity: 0.7,
                  }}
                >
                  Football club profile
                </p>
              </div>

              {/* Datos inferiores */}
              <div className="relative z-10 mt-20">
                <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
                  <div>
                    <p
                      className="text-[9px] font-bold uppercase tracking-widest"
                      style={{
                        color: secondaryTextColor,
                        opacity: 0.6,
                      }}
                    >
                      Año de fundación
                    </p>

                    <p
                      className="mt-2 text-xl font-bold"
                      style={{
                        color: primaryTextColor,
                      }}
                    >
                      {foundedYear || "—"}
                    </p>
                  </div>

                  <div>
                    <p
                      className="text-[9px] font-bold uppercase tracking-widest"
                      style={{
                        color: secondaryTextColor,
                        opacity: 0.6,
                      }}
                    >
                      País
                    </p>

                    <p
                      className="mt-2 text-xl font-bold"
                      style={{
                        color: primaryTextColor,
                      }}
                    >
                      {country || "—"}
                    </p>
                  </div>

                  <div>
                    <p
                      className="text-[9px] font-bold uppercase tracking-widest"
                      style={{
                        color: secondaryTextColor,
                        opacity: 0.6,
                      }}
                    >
                      Ciudad
                    </p>

                    <p
                      className="mt-2 text-xl font-bold"
                      style={{
                        color: primaryTextColor,
                      }}
                    >
                      {city || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Identidad inferior */}
              <div className="mt-14 flex items-center gap-8">
                <div
                  className="h-12 w-px"
                  style={{
                    backgroundColor: secondaryTextColor,
                    opacity: 0.4,
                  }}
                />

                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.4em]"
                    style={{
                      color: secondaryTextColor,
                    }}
                  >
                    {motto || "History · Passion · Identity"}
                  </p>

                  <div
                    className="mt-3 h-1 w-12"
                    style={{
                      backgroundColor: secondaryTextColor,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* =================================================
                COLUMNA DERECHA
            ================================================== */}

            <div className="relative flex min-h-[560px] flex-col justify-between p-8 md:p-12">
              {/* Datos superiores */}
              <div className="relative z-20 grid grid-cols-2 gap-x-8 gap-y-7 md:grid-cols-2">
                <div>
                  <p
                    className="text-[9px] font-bold uppercase tracking-widest"
                    style={{
                      color: secondaryTextColor,
                      opacity: 0.55,
                    }}
                  >
                    Ranking
                  </p>

                  <p
                    className="mt-1 text-3xl font-black"
                    style={{
                      color: secondaryTextColor,
                    }}
                  >
                    {ranking || "—"}
                  </p>

                  <p
                    className="text-xs"
                    style={{
                      color: secondaryTextColor,
                      opacity: 0.6,
                    }}
                  >
                    Mundial
                  </p>
                </div>

                <div>
                  <p
                    className="text-[9px] font-bold uppercase tracking-widest"
                    style={{
                      color: secondaryTextColor,
                      opacity: 0.55,
                    }}
                  >
                    Estadio
                  </p>

                  <p
                    className="mt-1 text-sm font-black"
                    style={{
                      color: secondaryTextColor,
                    }}
                  >
                    {stadium || "—"}
                  </p>

                  {stadiumCapacity && (
                    <p
                      className="mt-1 text-xs"
                      style={{
                        color: secondaryTextColor,
                        opacity: 0.6,
                      }}
                    >
                      Capacidad {stadiumCapacity}
                    </p>
                  )}
                </div>

                <div>
                  <p
                    className="text-[9px] font-bold uppercase tracking-widest"
                    style={{
                      color: secondaryTextColor,
                      opacity: 0.55,
                    }}
                  >
                    Fundación
                  </p>

                  <p
                    className="mt-1 text-xl font-black"
                    style={{
                      color: secondaryTextColor,
                    }}
                  >
                    {foundedYear || "—"}
                  </p>
                </div>

                <div>
                  <p
                    className="text-[9px] font-bold uppercase tracking-widest"
                    style={{
                      color: secondaryTextColor,
                      opacity: 0.55,
                    }}
                  >
                    Ciudad
                  </p>

                  <p
                    className="mt-1 text-xl font-black"
                    style={{
                      color: secondaryTextColor,
                    }}
                  >
                    {city || "—"}
                  </p>
                </div>

                <div>
                  <p
                    className="text-[9px] font-bold uppercase tracking-widest"
                    style={{
                      color: secondaryTextColor,
                      opacity: 0.55,
                    }}
                  >
                    País
                  </p>

                  <p
                    className="mt-1 text-xl font-black"
                    style={{
                      color: secondaryTextColor,
                    }}
                  >
                    {country || "—"}
                  </p>
                </div>
              </div>

              {/* =================================================
                  CAMISETA
              ================================================== */}

              {kitUrl && (
                <div className="pointer-events-none absolute inset-x-[-20px] top-[170px] z-30 flex items-center justify-center md:inset-x-[-100px] md:top-[180px]">
                  <img
                    src={kitUrl}
                    alt={`${teamName} home kit`}
                    className="h-[360px] w-[360px] object-contain drop-shadow-[0_30px_35px_rgba(0,0,0,0.35)] md:h-[530px] md:w-[530px]"
                  />
                </div>
              )}

              {/* Zona visual secundaria */}
              {!kitUrl && (
                <div
                  className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center text-[90px] font-black uppercase leading-none opacity-[0.08] md:text-[150px]"
                  style={{
                    ...condensedFont,
                    color: secondaryTextColor,
                  }}
                >
                  {shortName || teamName}
                </div>
              )}

              {/* Identidad inferior derecha */}
              <div className="relative z-20 mt-auto flex items-end justify-between gap-6 pt-80">
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.4em]"
                    style={{
                      color: secondaryTextColor,
                      opacity: 0.65,
                    }}
                  >
                    Team identity
                  </p>

                  <p
                    className="mt-3 text-2xl font-black uppercase tracking-[0.15em]"
                    style={{
                      ...condensedFont,
                      color: secondaryTextColor,
                    }}
                  >
                    {city || country || "Legacy"}
                  </p>
                </div>

                <div className="flex h-20 w-1 flex-col">
                  <div
                    className="h-1/2"
                    style={{
                      backgroundColor: primaryColor,
                    }}
                  />

                  <div
                    className="h-1/2"
                    style={{
                      backgroundColor: secondaryColor,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Línea decorativa inferior */}
          <div className="absolute bottom-0 left-0 right-0 z-40 flex h-1">
            <div
              className="w-1/2"
              style={{
                backgroundColor: primaryColor,
              }}
            />

            <div
              className="w-1/2"
              style={{
                backgroundColor: secondaryColor,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
