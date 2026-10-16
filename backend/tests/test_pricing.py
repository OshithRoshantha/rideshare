from app.services.pricing import compute_fare, compute_trip_totals


def test_worked_example():
    distances = [22, 22, 20, 19, 18, 17, 16, 15, 14, 14, 14, 13]
    rate = 18
    booking_fee = 20
    min_fare = 150

    breakdowns = [compute_fare(d, rate, booking_fee, min_fare) for d in distances]
    total_collected = sum(b.fare for b in breakdowns)
    distance_fares = [b.distance_fare for b in breakdowns]

    assert total_collected == 3912
    assert sum(distance_fares) == 3672

    totals = compute_trip_totals(
        distance_fares,
        [booking_fee] * len(distances),
        commission_pct=12,
        seats=14,
        trip_km_used=22,
        passenger_km_total=sum(distances),
    )
    assert totals.commission == 441
    assert totals.driver_payout == 3231
    assert totals.company_revenue == 681


def test_minimum_fare_applies_for_short_trips():
    breakdown = compute_fare(1, 18, 20, 150)
    assert breakdown.distance_fare == 18
    assert breakdown.fare == 150
