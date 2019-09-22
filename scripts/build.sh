set -o allexport
source .env
set +o allexport
#exit on any command failure
set -e
CHANGES=`git status --porcelain --untracked-files=no -s`
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
    echo "deploying to fuse dev"
    export NETWORK='fuse'
    npm run deploy:full
    echo "deploying to fuse staging"
    export NETWORK='staging'
    npm run deploy:full
    read -p "deploy to production? " prompt
    if [[ $PRIVATE_KEY_PROD && $prompt =~ [yY](es)? ]]
    then
        export PRIVATE_KEY=$PRIVATE_KEY_PROD
        export NETWORK='production'
        npm run deploy:full
    fi        
    
fi
read -p "Are you sure you want to continue to publish a new version to npm? <y/N> " prompt
if [[ $prompt =~ [yY](es)? ]]
then
    git add build/contracts/*
    git commit -a -m "add: version release"
    npm version patch
    git push --follow-tags
    npm pack
    npm publish
fi
