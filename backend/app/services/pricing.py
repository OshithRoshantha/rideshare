"""Pure pricing functions. No I/O, no side effects — unit tested directly."""

from dataclasses import dataclass


@dataclass
class FareBreakdown:
    passenger_km: float
    rate_per_km: float
    booking_fee: float
    distance_fare: float
    fare: float


def compute_distance_fare(passenger_km: float, rate_per_km: float) -> float:
    return round(passenger_km * rate_per_km)


def compute_fare(
    passenger_km: float,
    rate_per_km: float,
    booking_fee: float,
    minimum_fare: float,
) -> FareBreakdown:
    distance_fare = compute_distance_fare(passenger_km, rate_per_km)
    fare = max(minimum_fare, booking_fee + distance_fare)
    return FareBreakdown(
        passenger_km=passenger_km,
        rate_per_km=rate_per_km,
        booking_fee=booking_fee,
        distance_fare=distance_fare,
        fare=fare,
    )


def compute_solo_estimate(passenger_km: float, solo_rate_per_km: float) -> float:
    return round(passenger_km * solo_rate_per_km)


def compute_savings_pct(fare: float, solo_estimate: float) -> float:
    if solo_estimate <= 0:
        return 0
    return round((1 - fare / solo_estimate) * 100)


@dataclass
class TripTotals:
    passengers: int
    passenger_km: float
    distance_fares: float
    booking_fees: float
    commission: float
    driver_payout: float
    company_revenue: float
    occupancy_pct: float


def compute_trip_totals(
    distance_fares: list[float],
    booking_fees: list[float],
    commission_pct: float,
    seats: int,
    trip_km_used: float,
    passenger_km_total: float,
) -> TripTotals:
    sum_distance_fares = sum(distance_fares)
    sum_booking_fees = sum(booking_fees)
    commission = round(sum_distance_fares * commission_pct / 100)
    driver_payout = sum_distance_fares - commission
    company_revenue = commission + sum_booking_fees
    occupancy_pct = 0.0
    if seats > 0 and trip_km_used > 0:
        occupancy_pct = round((passenger_km_total / (seats * trip_km_used)) * 100, 1)
    return TripTotals(
        passengers=len(distance_fares),
        passenger_km=passenger_km_total,
        distance_fares=sum_distance_fares,
        booking_fees=sum_booking_fees,
        commission=commission,
        driver_payout=driver_payout,
        company_revenue=company_revenue,
        occupancy_pct=occupancy_pct,
    )
