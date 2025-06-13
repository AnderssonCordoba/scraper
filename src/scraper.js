const puppeteer = require('puppeteer');

async function obtenerEstadisticasDesdeURL(partidoUrlPrincipal) {
  const browser = await puppeteer.launch({ headless: true });

  async function obtenerEquiposYUrlsResultados(urlPartido) {
    const page = await browser.newPage();
    await page.goto(urlPartido, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.Gamestrip__Competitors');

    const equipos = await page.evaluate(() => {
      const equipoLocal = document.querySelector('.Gamestrip__Team--left .Gamestrip__InfoWrapper h2')?.textContent?.trim();
      const equipoVisitante = document.querySelector('.Gamestrip__Team--right .Gamestrip__InfoWrapper h2')?.textContent?.trim();
      const linkLocal = document.querySelector('.Gamestrip__Team--left a')?.href || null;
      const linkVisitante = document.querySelector('.Gamestrip__Team--right a')?.href || null;
      const escudoLocal = document.querySelector('.Gamestrip__Team--left img')?.src || null;
      const escudoVisitante = document.querySelector('.Gamestrip__Team--right img')?.src || null;

      return {
        equipoLocal: { nombre: equipoLocal, url: linkLocal, escudo: escudoLocal },
        equipoVisitante: { nombre: equipoVisitante, url: linkVisitante, escudo: escudoVisitante }
      };
    });

    await page.close();
    return equipos;
  }

  async function obtenerUrlsPartidosEquipo(equipoUrl) {
    const page = await browser.newPage();
    await page.goto(equipoUrl, { waitUntil: 'networkidle2' });
    await page.waitForSelector('span.Nav__Text[data-resource-id="team.resultados_tab"]');

    const resultadosUrl = await page.evaluate(() => {
      const elem = document.querySelector('span.Nav__Text[data-resource-id="team.resultados_tab"]');
      return elem?.closest('a')?.href || null;
    });

    if (!resultadosUrl) {
      await page.close();
      return [];
    }

    await page.goto(resultadosUrl, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.Table__TBODY');

    const partidosUrls = await page.evaluate(() => {
      const filas = Array.from(document.querySelectorAll('.Table__TBODY > tr'));
      const urls = [];

      for (const fila of filas) {
        const estado = fila.querySelector('td span[data-testid="result"] a')?.innerText?.trim();
        const linkPartido = fila.querySelector('td span[data-testid="score"] a[href*="/partido/"]');

        if (estado === 'Finalizado' && linkPartido) {
          const urlPartido = linkPartido.getAttribute('href').replace('/partido/', '/numeritos/');
          urls.push('https://www.espn.com.co' + urlPartido);
        }

        if (urls.length >= 10) break;
      }

      return urls;
    });

    await page.close();
    return partidosUrls;
  }

  async function obtenerStatsPartido(urlPartido, nombreMiEquipo) {
    const page = await browser.newPage();
    await page.goto(urlPartido, { waitUntil: 'networkidle2' });

    await page.waitForSelector('#fittPageContainer .Gamestrip__Competitors');
    const { equipoLocal, equipoVisitante } = await page.evaluate(() => {
      const local = document.querySelector('.Gamestrip__Team--left .Gamestrip__InfoWrapper h2')?.textContent?.trim();
      const visitante = document.querySelector('.Gamestrip__Team--right .Gamestrip__InfoWrapper h2')?.textContent?.trim();
      const escudoLocal = document.querySelector('.Gamestrip__Team--left img')?.src || null;
      const escudoVisitante = document.querySelector('.Gamestrip__Team--right img')?.src || null;

      return {
        equipoLocal: { nombre: local, escudo: escudoLocal },
        equipoVisitante: { nombre: visitante, escudo: escudoVisitante }
      };
    });

    const esLocal = equipoLocal.nombre === nombreMiEquipo;

    await page.waitForSelector('section div:nth-child(3) div > span');
    await page.waitForSelector('section div:nth-child(6) div > span');

    const stats = await page.evaluate(() => {
      const getText = (selector) => document.querySelector(selector)?.innerText?.trim() || '0';
      const getAnotaciones = (selector) => {
        const elems = Array.from(document.querySelectorAll(selector));
        const resultado = [];

        elems.forEach(e => {
          const nombre = e.querySelector('strong')?.innerText?.trim();
          const minutosRaw = e.querySelector('span')?.innerText?.replace(/\s*-\s*/g, '')?.trim();

          if (nombre && minutosRaw) {
            minutosRaw.split(',').map(m => m.trim()).forEach(minuto => resultado.push({ nombre, minuto }));
          }
        });

        return resultado;
      };

      return {
        golesLocal: parseInt(getText('#fittPageContainer .Gamestrip__Team--left .Gamestrip__Score')),
        golesVisitante: parseInt(getText('#fittPageContainer .Gamestrip__Team--right .Gamestrip__Score')),
        disparoAGol: [getText('section div:nth-child(3) div.UGvDX.vIfRz > span'), getText('section div:nth-child(3) div.SolpO.VyZCd > span')],
        tirosRealizados: [getText('section div:nth-child(4) div.UGvDX.vIfRz > span'), getText('section div:nth-child(4) div.SolpO.VyZCd > span')],
        faltas: [getText('section div:nth-child(5) div.UGvDX.vIfRz > span'), getText('section div:nth-child(5) div.SolpO.VyZCd > span')],
        tarjetasAmarillas: [getText('section div:nth-child(6) div.UGvDX.vIfRz > span'), getText('section div:nth-child(6) div.SolpO.VyZCd > span')],
        tarjetasRojas: [getText('section div:nth-child(7) div.UGvDX.vIfRz > span'), getText('section div:nth-child(7) div.SolpO.VyZCd > span')],
        tirosEsquina: [getText('section div:nth-child(8) div.UGvDX.vIfRz > span'), getText('section div:nth-child(8) div.SolpO.VyZCd > span')],
        salvadas: [getText('section div:nth-child(9) div.UGvDX.vIfRz > span'), getText('section div:nth-child(9) div.SolpO.VyZCd > span')],
        anotacionesLocal: getAnotaciones('#fittPageContainer .SoccerPerformers__Competitor--left li'),
        anotacionesVisitante: getAnotaciones('#fittPageContainer .SoccerPerformers__Competitor--right li'),
      };
    });

    await page.close();

    const datosEquipo = (eq, stats, i) => ({
      nombre: eq.nombre,
      escudo: eq.escudo,
      goles: stats[`goles${i}`],
      disparoAGol: stats.disparoAGol[i === 'Local' ? 0 : 1],
      tirosRealizados: stats.tirosRealizados[i === 'Local' ? 0 : 1],
      faltas: stats.faltas[i === 'Local' ? 0 : 1],
      tarjetasAmarillas: stats.tarjetasAmarillas[i === 'Local' ? 0 : 1],
      tarjetasRojas: stats.tarjetasRojas[i === 'Local' ? 0 : 1],
      tirosEsquina: stats.tirosEsquina[i === 'Local' ? 0 : 1],
      salvadas: stats.salvadas[i === 'Local' ? 0 : 1],
      anotaciones: stats[`anotaciones${i}`]
    });

    return {
      miEquipo: esLocal ? datosEquipo(equipoLocal, stats, 'Local') : datosEquipo(equipoVisitante, stats, 'Visitante'),
      adversario: esLocal ? datosEquipo(equipoVisitante, stats, 'Visitante') : datosEquipo(equipoLocal, stats, 'Local')
    };
  }

  async function obtenerStatsUltimosPartidos(equipo) {
    const partidosUrls = await obtenerUrlsPartidosEquipo(equipo.url);
    const resultados = [];
    for (const url of partidosUrls) {
      const stats = await obtenerStatsPartido(url, equipo.nombre);
      resultados.push(stats);
    }
    return resultados;
  }

  function calcularEstadisticas(valores) {
    if (valores.length === 0) return null;

    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    const sorted = [...valores].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const mediana = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    const frecuencia = {};
    let moda = null, maxFreq = 0;
    for (const val of valores) {
      frecuencia[val] = (frecuencia[val] || 0) + 1;
      if (frecuencia[val] > maxFreq || (frecuencia[val] === maxFreq && val < moda)) {
        maxFreq = frecuencia[val];
        moda = val;
      }
    }

    const min = Math.min(...valores);
    const desviacionModa = moda - min;
    const desviacionMedia = media - min;
    const desviacionMediana = mediana - min;

    return {
      valores,
      promedios: {
        moda,
        media: parseFloat(media.toFixed(2)),
        mediana
      },
      minimos: {
        moda: parseFloat((moda - desviacionModa).toFixed(2)),
        media: parseFloat((media - desviacionMedia).toFixed(2)),
        mediana: parseFloat((mediana - desviacionMediana).toFixed(2))
      }
    };
  }

  function extraerValores(equipo, campo) {
    return equipo.map(p => parseInt(p.miEquipo[campo]) || 0);
  }

  function calcularResumenEquipo(equipo) {
    return {
      goles: calcularEstadisticas(extraerValores(equipo, 'goles')),
      disparoAGol: calcularEstadisticas(extraerValores(equipo, 'disparoAGol')),
      tirosRealizados: calcularEstadisticas(extraerValores(equipo, 'tirosRealizados')),
      tirosEsquina: calcularEstadisticas(extraerValores(equipo, 'tirosEsquina')),
      faltas: calcularEstadisticas(extraerValores(equipo, 'faltas')),
      tarjetasAmarillas: calcularEstadisticas(extraerValores(equipo, 'tarjetasAmarillas')),
      tarjetasRojas: calcularEstadisticas(extraerValores(equipo, 'tarjetasRojas')),
      salvadas: calcularEstadisticas(extraerValores(equipo, 'salvadas'))
    };
  }

  async function main() {
    const equipos = await obtenerEquiposYUrlsResultados(partidoUrlPrincipal);
    const equipoA = await obtenerStatsUltimosPartidos(equipos.equipoLocal);
    const equipoB = await obtenerStatsUltimosPartidos(equipos.equipoVisitante);

    const resultadoFinal = {
      equipoA,
      equipoB,
      estadisticas: {
        ultimos10: {
          equipoA: calcularResumenEquipo(equipoA),
          equipoB: calcularResumenEquipo(equipoB)
        },
        ultimos5: {
          equipoA: calcularResumenEquipo(equipoA.slice(0, 5)),
          equipoB: calcularResumenEquipo(equipoB.slice(0, 5))
        }
      }
    };

    await browser.close();
    return resultadoFinal;
  }

  return await main();
}

module.exports = obtenerEstadisticasDesdeURL;
