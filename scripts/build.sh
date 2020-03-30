set -o allexport
source .env
set +o allexport
#exit on any command failure
set -e
CHANGES=`git status --porcelain --untracked-files=no -s`
if [[ -z $1 || -z $2 ]]
then
    echo "./build.sh deploy/publish <npm version>";
    exit -1;
fi
if [[ $CHANGES ]]
then 
    echo "Warning git not clean";
fi
if [[ -z $MNEMONIC_STAGING || -z $INFURA_API ]]
then
    echo "Error MNEMONIC missing no env?";
    exit -1;
fi
if [[  $1 == 'deploy' ]]
then 
    export MNEMONIC=$MNEMONIC_STAGING
    export ADMIN_MNEMONIC=$ADMIN_MNEMONIC_STAGING
    echo "deploying to fuse dev"
    export NETWORK='fuse'
    npm run deploy
    echo "deploying to fuse staging"
    export NETWORK='staging'
    npm run deploy
fi
if [[  $1 == 'prod' ]]
then 
    read -p "deploy to production? " prompt
    if [[ $PRIVATE_KEY_PROD && $prompt =~ [yY](es)? ]]
    then
        export PRIVATE_KEY=$PRIVATE_KEY_PROD
        export ADMIN_MNEMONIC=$ADMIN_MNEMONIC_PRODUCTION
        export NETWORK='production'
        npm run deploy
    fi        
    
fi
read -p "Are you sure you want to continue to publish a new version to npm? <y/N> " prompt
if [[ $prompt =~ [yY](es)? ]]
then
    ./scripts/minimize.sh build/contracts
    git add build/contracts/*
    git commit -a -m "add: version $2"
    npm version $2
    git push --follow-tags
    npm pack
    npm publish
fi
