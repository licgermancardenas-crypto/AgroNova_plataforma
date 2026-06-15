"""
Cotizaciones_Externas - series históricas diarias 2016-2026
USD/ARS oficial, dólar blue, soja CBOT, maíz CBOT, urea FOB.
"""

import pandas as pd
import numpy as np
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from config import CSV_DIR, SEED, USD_ARS

rng = np.random.default_rng(SEED + 4)

# Precios USD base por commodity (promedio anual, en USD/ton para granos, USD/ton para urea)
SOJA_CBOT = {   # USD/ton aprox histórico
    2016: 375, 2017: 385, 2018: 330, 2019: 345, 2020: 395,
    2021: 490, 2022: 580, 2023: 490, 2024: 380, 2025: 370, 2026: 365,
}
MAIZ_CBOT = {   # USD/ton aprox histórico
    2016: 165, 2017: 170, 2018: 175, 2019: 165, 2020: 185,
    2021: 235, 2022: 280, 2023: 230, 2024: 185, 2025: 178, 2026: 172,
}
TRIGO_CBOT = {  # USD/ton aprox histórico
    2016: 165, 2017: 172, 2018: 198, 2019: 185, 2020: 202,
    2021: 238, 2022: 380, 2023: 245, 2024: 215, 2025: 210, 2026: 205,
}
UREA_FOB = {    # USD/ton FOB Árabe del Golfo
    2016: 195, 2017: 228, 2018: 275, 2019: 250, 2020: 238,
    2021: 450, 2022: 780, 2023: 320, 2024: 290, 2025: 280, 2026: 270,
}
# Dólar blue premium sobre oficial (multiplicador)
BLUE_PREMIUM = {
    2016: 1.08, 2017: 1.05, 2018: 1.15, 2019: 1.35,
    2020: 1.65, 2021: 1.90, 2022: 1.85, 2023: 2.10,
    2024: 1.12, 2025: 1.08, 2026: 1.06,
}


def add_noise(base, volatility=0.025):
    return base * (1 + rng.normal(0, volatility))


def generate():
    dates = pd.date_range("2016-01-01", "2026-12-31", freq="D")
    dates = dates[dates.weekday < 5]  # solo días hábiles

    rows = []
    for d in dates:
        y = d.year
        usd_ars_oficial = USD_ARS.get(y, 14.8) * (1 + rng.normal(0, 0.008))
        blue_mult = BLUE_PREMIUM.get(y, 1.1)
        rows.append({
            "fecha":               d.date(),
            "fecha_id":            int(d.strftime("%Y%m%d")),
            "usd_ars_oficial":     round(add_noise(USD_ARS.get(y, 14.8), 0.01), 2),
            "usd_ars_blue":        round(add_noise(USD_ARS.get(y, 14.8) * blue_mult, 0.015), 2),
            "soja_cbot_usd_ton":   round(add_noise(SOJA_CBOT.get(y, 400), 0.02), 2),
            "maiz_cbot_usd_ton":   round(add_noise(MAIZ_CBOT.get(y, 190), 0.02), 2),
            "trigo_cbot_usd_ton":  round(add_noise(TRIGO_CBOT.get(y, 200), 0.02), 2),
            "urea_fob_usd_ton":    round(add_noise(UREA_FOB.get(y, 300), 0.025), 2),
        })

    df = pd.DataFrame(rows)
    out = os.path.join(CSV_DIR, "Cotizaciones_Externas.csv")
    df.to_csv(out, index=False, encoding="utf-8-sig")
    print(f"[OK] Cotizaciones_Externas: {len(df):,} filas -> {out}")
    return df


if __name__ == "__main__":
    generate()
