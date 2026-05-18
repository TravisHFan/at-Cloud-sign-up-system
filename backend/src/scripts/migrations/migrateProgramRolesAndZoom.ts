import dotenv from "dotenv";
import mongoose from "mongoose";
import { Program } from "../../models";
import {
  syncLegacyProgramPricingFields,
  type ProgramRolesShape,
} from "../../utils/programRoles";

dotenv.config();

type ProgramMigrationSnapshot = {
  _id: mongoose.Types.ObjectId;
  zoomLink?: string;
  meetingId?: string;
  passcode?: string;
  programRoles?: ProgramRolesShape;
  classRepDiscount?: number;
  classRepLimit?: number;
  classRepCount?: number;
};

async function migrateProgramRolesAndZoom(): Promise<void> {
  const mongoUri =
    process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
  await mongoose.connect(mongoUri);

  try {
    const programs = (await Program.find({})) as ProgramMigrationSnapshot[];
    let migratedCount = 0;

    for (const program of programs) {
      const pricingMirror = {
        programRoles: program.programRoles,
        classRepDiscount: program.classRepDiscount,
        classRepLimit: program.classRepLimit,
        classRepCount: program.classRepCount,
      };
      syncLegacyProgramPricingFields(pricingMirror);

      await Program.updateOne(
        { _id: program._id },
        {
          $set: {
            programRoles: pricingMirror.programRoles,
            classRepDiscount: pricingMirror.classRepDiscount,
            classRepLimit: pricingMirror.classRepLimit,
            classRepCount: pricingMirror.classRepCount,
            zoomLink: program.zoomLink || "",
            meetingId: program.meetingId || "",
            passcode: program.passcode || "",
          },
        },
        { runValidators: true },
      );
      migratedCount += 1;
    }

    console.log(`Migrated ${migratedCount} program(s).`);
  } finally {
    await mongoose.connection.close();
  }
}

export { migrateProgramRolesAndZoom };

if (require.main === module) {
  migrateProgramRolesAndZoom()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Program roles and Zoom migration failed:", error);
      process.exit(1);
    });
}
