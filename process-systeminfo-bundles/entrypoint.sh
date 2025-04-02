#!/bin/bash
set -e

if [ -z ${GH_TOKEN+x} ]; then
    echo "GH_TOKEN is unset. Make sure it's set to a GitHub token that can be used for updating comments."
    exit -1
fi

# verify token
gh auth status

if [ -z ${REPO+x} ]; then
    echo "REPO is unset. Make sure it's set to the target repo (format: owner/name)."
    exit -1
fi

if [ -z ${COMMENT_ID+x} ]; then
    echo "COMMENT_ID is unset. Make sure it's set to the comment id."
    exit -1
fi

if [ -z ${COMMENT_BODY+x} ]; then
    comment=$(gh api \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      /repos/$REPO/issues/comments/$COMMENT_ID | jq -r ".body"
    )
else
    comment="$COMMENT_BODY"
fi

BOTMARKER="<!-- process-systeminfo-bundles -->"
ALT_BOTMARKER="<!-- linkify_bundles -->"

CONTAINS_BOTMARKER=$(echo "$comment" | grep -q "$BOTMARKER" && echo "1" || echo "0")
CONTAINS_ALT_BOTMARKER=$(echo "$comment" | grep -q "$ALT_BOTMARKER" && echo "1" || echo "0")

# strip existing botmarkers and tail, plus all bundle footnotes
comment="${comment%$BOTMARKER*}"
comment="${comment%$ALT_BOTMARKER*}"
comment="${comment//\[^bundle[0-9]\]/}"

declare -A bundles

# extract bundle data
echo "Detecting potential bundles..."
for match in $(echo "$comment" | grep -oP "\[octoprint-systeminfo-\d{14}\.zip\]\([^)]+\)"); do
    name=$(echo "$match" | grep -oP "(?<=\[)(.*?)(?=(\]|\Z))")
    echo "  Found bundle $name..."
    
    if [[ ! -v bundles[$name] ]]; then
        url=$(echo "$match" | grep -oP "(?<=\()(.*?)(?=(\)|\Z))")
        bundles[$name]=$(echo -e "$name|$url|$match")
    fi
done
echo "Found what looks like ${#bundles[@]} bundle(s)"
echo

if [ "${#bundles[@]}" != "0" ]; then
    counter=1
    body=""
    padding="                              "

    for line in "${bundles[@]}"; do
        name=$(echo -e "$line" | cut -d'|' -f1)
        url=$(echo -e "$line" | cut -d'|' -f2)
        match=$(echo -e "$line" | cut -d'|' -f3)
        echo "Processing bundle #$counter ($name)..."

        encoded=$(printf %s "$url" | jq -sRr @uri)

        footnote="bundle$counter"
        indent=$((${#footnote}+5))
        prefix=$(printf "%s" "${padding:0:${indent}}")

        extra=""
        systeminfo=$(curl -sL "$url" -o tmp.zip && unzip -p "tmp.zip" "systeminfo.txt" || true)
        rm tmp.zip || true
        if [ "$systeminfo" != "" ]; then
            echo "  Extracting systeminfo..."

            # extract versions, OS & browser info
            version=$(echo -e "$systeminfo" | grep "octoprint.version:" | cut -d" " -f 2- || echo "unknown")
            python=$(echo -e "$systeminfo" | grep "env.python.version:" | cut -d" " -f 2- || echo "unknown")
            os=$(echo -e "$systeminfo" | grep "env.os.platform:" | cut -d" " -f 2- || echo "unknown")
            browser=$(echo -e "$systeminfo" | grep "browser.user_agent:" | cut -d" " -f 2- || echo "unknown")
            extra="\n$prefix**OctoPrint**: $version\n$prefix**Python**: $python\n$prefix**OS**: $os"

            # extract information about the underlying RPi, if available
            rpi=$(echo -e "$systeminfo" | grep "env.plugins.pi_support.model:" | cut -d" " -f 2- || echo "")
            if [ "$rpi" != "" ]; then
                extra="$extra\n$prefix**RPi**: $rpi"
            fi

            # extract information about OctoPi, if available
            octopi=$(echo -e "$systeminfo" | grep "env.plugins.pi_support.octopi_version:" | cut -d" " -f 2- || echo "")
            camerastack=$(echo -e "$systeminfo" | grep "env.plugins.pi_support.octopi_camera_stack:" | cut -d" " -f 2- || echo "")
            uptodate=$(echo -e "$systeminfo" | grep "env.plugins.pi_support.octopiuptodate_build_short" | cut -d" " -f 2- || echo "")
            if [ "$octopi" != "" ]; then
                octopi_version="$octopi"
                if [ "$camerastack" == "camera-streamer" ]; then
                    octopi_version="${octopi_version}cam"
                fi
                if [ "$uptodate" != "" ]; then
                    octopi_version="$octopi_version (build $uptodate)"
                fi
                extra="$extra\n$prefix**OctoPi**: $octopi_version"
            fi

            extra="$extra\n$prefix**Browser**: $browser"
        fi

        escaped_keyword=$(printf '%s\n' "$match" | sed -e 's/[]\/$*.^[]/\\&/g')
        escaped_replace=$(printf '%s\n' "$match[^$footnote]" | sed -e 's/[\/&]/\\&/g')
        comment="${comment//${escaped_keyword}/${match}[^${footnote}]}"

        body="$body[^$footnote]: \`$name\` ([bundleviewer](https://bundleviewer.octoprint.org/?url=$encoded)) ([download]($url))$extra\n"

        counter=$((counter+1))
    done
    
    updated="$comment$BOTMARKER\n$body\n"

    echo
    echo "Setting bundle summary on comment..."

    echo -e "$updated" | gh api \
      --method PATCH \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      /repos/$REPO/issues/comments/$COMMENT_ID \
      -F "body=@-" > /dev/null

    echo "...done"

else 
    if [ "$CONTAINS_BOTMARKER" == "1" ] || [ "$CONTAINS_ALT_BOTMARKER" == "1" ]; then
        echo "No bundles found, removing bundle summary from comment..."

        echo -e "$comment" | gh api \
          --method PATCH \
          -H "Accept: application/vnd.github+json" \
          -H "X-GitHub-Api-Version: 2022-11-28" \
          /repos/$REPO/issues/comments/$COMMENT_ID \
          -F "body=@-" > /dev/null

        echo "...done"
    fi
fi

[ -n "$GITHUB_OUTPUT" ] && echo "count=${#bundles[@]}" >> $GITHUB_OUTPUT
