export const ivecoModels = [
  "35-150", 
  "35-160", 
  "45-160", 
  "50-180", 
  "55-160", 
  "70-180"
];

export const maintenanceManual = {
  manual_name: "Iveco Daily 5803345473 Ed06",
  schedules: {
    standard: [
      { km_interval: 30000, description: "Troca de óleo e filtro de óleo", estimated_downtime_hours: 4 },
      { km_interval: 60000, description: "Substituição correias auxiliares", estimated_downtime_hours: 8 },
      { km_interval: 90000, description: "Substituição filtro blow-by", estimated_downtime_hours: 2 },
      { km_interval: 180000, description: "Troca óleo caixa Hi-Matic", estimated_downtime_hours: 6 }
    ],
    conditional: [
      { item: "Filtro de Ar", condition: "30000 km ou uso severo" },
      { item: "Filtro de Combustível", condition: "30000 km ou drenagem semanal" }
    ]
  }
};

export function predictNextMaintenance(
  currentMileage: number,
  createdAt: Date,
  lastMaintenanceKm?: number
) {
  const now = new Date();
  
  // Calculate days of use (minimum 1 to avoid division by zero)
  let diffTime = now.getTime() - createdAt.getTime();
  if (diffTime < 0) diffTime = 0;
  const daysOfUse = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  
  const dailyAverageKm = currentMileage / daysOfUse;

  // Utilize last maintenance to find the next milestone
  let baseKm = currentMileage;
  if (lastMaintenanceKm && lastMaintenanceKm > 0) {
    baseKm = lastMaintenanceKm;
  }

  // The base module is 30k. Find the next 30k multiple after baseKm.
  // If baseKm is exactly a multiple, it will increment to the next one.
  const nextMileageThreshold = Math.floor(baseKm / 30000) * 30000 + 30000;
  const remainingKm = Math.max(0, nextMileageThreshold - currentMileage);
  
  // Predict days to reach the next milestone
  const daysToNext = dailyAverageKm > 0 ? remainingKm / dailyAverageKm : 90; // Default 90 days if average is 0
  
  const predictedDate = new Date();
  predictedDate.setDate(predictedDate.getDate() + daysToNext);

  const services: string[] = [];
  const parts: string[] = [];
  let totalDowntimeHours = 0;

  // Add standard services that fall on this multiple
  maintenanceManual.schedules.standard.forEach(schedule => {
    if (nextMileageThreshold % schedule.km_interval === 0) {
      services.push(schedule.description);
      totalDowntimeHours += schedule.estimated_downtime_hours;
    }
  });

  // Add conditional items that usually happen at 30k
  if (nextMileageThreshold % 30000 === 0) {
    maintenanceManual.schedules.conditional.forEach(cond => {
      parts.push(cond.item);
      totalDowntimeHours += 1; // Arbitrarily adding 1 hour for conditionals
    });
  }

  // Estimated full days of downtime (assuming 8 hours workday)
  const estimatedDowntimeDays = Math.ceil(totalDowntimeHours / 8);

  return {
    nextMileage: nextMileageThreshold,
    predictedDate,
    services,
    parts,
    estimatedDowntimeDays,
    dailyAverageKm: Math.round(dailyAverageKm)
  };
}