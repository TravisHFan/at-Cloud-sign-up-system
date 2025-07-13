import { getAvatarUrl } from "../../utils/avatarUtils";

export default function AvatarTest() {
  const testFemale = getAvatarUrl(null, "female");
  const testMale = getAvatarUrl(null, "male");

  return (
    <div className="p-4 bg-gray-100">
      <h3 className="text-lg font-bold mb-4">Avatar Test</h3>
      <div className="flex space-x-4">
        <div>
          <p>Female Avatar:</p>
          <img
            src={testFemale}
            alt="Female"
            className="w-16 h-16 rounded-full"
          />
          <p className="text-xs">{testFemale}</p>
        </div>
        <div>
          <p>Male Avatar:</p>
          <img src={testMale} alt="Male" className="w-16 h-16 rounded-full" />
          <p className="text-xs">{testMale}</p>
        </div>
      </div>
    </div>
  );
}
