const fse = require("fs-extra");

module.exports = async function(deployment, network) {
  const dir = "releases/";
  console.log("releaser:", { network, dir });
  const previousDeployment = await fse
    .readJson(dir + "/deployment.json")
    .catch(_ => {});
  console.log("releaser:", { previousDeployment });
  await fse.ensureDir(dir);
  let finalDeployment = { ...previousDeployment, [network]: deployment };
  console.log("releaser:", {
    previousDeployment: previousDeployment[network],
    finalDeployment: finalDeployment[network]
  });
  return fse.writeJson(dir + "/deployment.json", finalDeployment);
};
