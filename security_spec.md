# Security Specification - FleetFlow

## Data Invariants
1. A Maintenance Record cannot exist without a valid Vehicle ID.
2. Only the owner of a vehicle can add or view its maintenance records and schedules.
3. License plates must be unique (enforced via client logic, but rules must prevent unauthorized hijacking).
4. `ownerId` field is immutable once set.
5. `currentMileage` must be a positive number.

## The "Dirty Dozen" Payloads (Attack Vectors)

1. **Identity Spoofing**: Attempting to create a vehicle with someone else's `ownerId`.
2. **Orphaned Record**: Creating a maintenance record for a `vehicleId` that doesn't exist.
3. **Privilege Escalation**: Non-owner trying to update the `currentMileage` of a vehicle.
4. **ID Poisoning**: Injecting a 2KB string as a `vehicleId`.
5. **Schema Breach**: Adding a `price` field to the `Vehicle` document (shadow field).
6. **Negative Value Attack**: Setting `currentMileage` to -500.
7. **Bypassing Invariants**: Creating a maintenance record with a future date for a "past" service.
8. **Owner Hijacking**: Attempting to change the `ownerId` of an existing vehicle.
9. **Spam Attacks**: Creating 10,000 maintenance records in a batch (rules must check sizes).
10. **PII Leak**: Unauthorized user trying to list all vehicles in the database.
11. **Type Confusion**: Sending `currentMileage` as a string instead of a number.
12. **Status Corruption**: Setting a vehicle status to "sold" when that's not a valid enum value.

## Test Strategy
All these payloads must return `PERMISSION_DENIED` when targeting the `/vehicles/`, `/maintenance_records/`, or `/maintenance_schedules/` collections if they violate the ownership or schema guards.
