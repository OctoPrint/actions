#!/bin/bash
set -e

if [ -z ${TOKEN} ]; then
    echo "TOKEN is unset or empty. Make sure it's set to a GitHub token that can be used for updating comments."
    exit -1
fi
export GH_TOKEN=$TOKEN

# verify token
gh auth status

if [ -z ${REPO} ]; then
    echo "REPO is unset or empty. Make sure it's set to the target repo (format: owner/name)."
    exit -1
fi

if [ -z ${COMMENT} ] && [ -z ${ISSUE} ]; then
    echo "Both ISSUE and COMMENT are unset or empty. Make sure one is set."
    exit -1
fi
if [ -z ${COMMENT} ]; then
    echo "Operating on body of issue #$ISSUE"
else
    echo "Operating on body of comment $COMMENT"
fi

if [ -z ${BODY} ]; then
    if [ -z ${COMMENT} ]; then
        BODY=$(gh api \
            -H "Accept: application/vnd.github+json" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            /repos/$REPO/issues/$ISSUE | jq -r ".body"
            )
    else
        BODY=$(gh api \
            -H "Accept: application/vnd.github+json" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            /repos/$REPO/issues/comments/$COMMENT | jq -r ".body"
            )
    fi
fi

comment="$BODY"

BOTMARKER="<!-- process-systeminfo-bundles -->"
ALT_BOTMARKER="<!-- linkify_bundles -->"

CONTAINS_BOTMARKER=$(echo "$comment" | grep -q "$BOTMARKER" && echo "1" || echo "0")
CONTAINS_ALT_BOTMARKER=$(echo "$comment" | grep -q "$ALT_BOTMARKER" && echo "1" || echo "0")

# strip existing botmarkers and tail, plus all bundle footnotes, and trim
comment="${comment%$BOTMARKER*}"
comment="${comment%$ALT_BOTMARKER*}"
comment="${comment//\[^bundle[0-9]\]/}"
comment=$(echo -e "$comment" | sed -z "s/\n*$//")

declare -A bundles

# extract bundle data
echo "Detecting potential bundles..."
for match in $(echo "$comment" | grep -oP "\[octoprint-systeminfo-\d{14}\.zip\]\(https://github\.com/user-attachments/files/[0-9]+/octoprint-systeminfo-\d{14}\.zip\)"); do
    # we are only interested in links to github user-attachments matching our filename octoprint-systeminfo-<timestamp>.zip
    name=$(echo "$match" | grep -oP "(?<=\[)(.*?)(?=(\]|\Z))")
    echo "  Found bundle $name..."
    
    if [[ ! -v bundles[$name] ]]; then
        url=$(echo "$match" | grep -oP "(?<=\()(.*?)(?=(\)|\Z))")
        bundles[$name]=$(echo -e "$name|$url|$match")
    fi
done
echo "Detected ${#bundles[@]} bundle(s)"
echo

if [ "${#bundles[@]}" != "0" ]; then
    counter=1
    footnotes=""
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

        footnotes="$footnotes[^$footnote]: \`$name\` ([bundleviewer](https://bundleviewer.octoprint.org/?url=$encoded)) ([download]($url))$extra\n"

        counter=$((counter+1))
    done
    
    updated="$comment\n\n$BOTMARKER\n$footnotes\n"

    if ! diff -B <(echo -e "$BODY") <(echo -e "$updated"); then
        echo
        echo "Setting bundle summary on post..."

        if [ -z ${COMMENT} ]; then
            echo -e "$updated" | gh api \
                --method PATCH \
                -H "Accept: application/vnd.github+json" \
                -H "X-GitHub-Api-Version: 2022-11-28" \
                /repos/$REPO/issues/$ISSUE \
                -F "body=@-" > /dev/null
        else
            echo -e "$updated" | gh api \
                --method PATCH \
                -H "Accept: application/vnd.github+json" \
                -H "X-GitHub-Api-Version: 2022-11-28" \
                /repos/$REPO/issues/comments/$COMMENT \
                -F "body=@-" > /dev/null
        fi

        echo "...done"
    else
        echo
        echo "No changes to post detected, doing nothing"
    fi

else 
    if [ "$CONTAINS_BOTMARKER" == "1" ] || [ "$CONTAINS_ALT_BOTMARKER" == "1" ]; then
        echo "No bundles found, removing bundle summary from post..."

        if [ -z ${COMMENT} ]; then
            echo -e "$comment" | gh api \
                --method PATCH \
                -H "Accept: application/vnd.github+json" \
                -H "X-GitHub-Api-Version: 2022-11-28" \
                /repos/$REPO/issues/$ISSUE \
                -F "body=@-" > /dev/null
        else
            echo -e "$comment" | gh api \
                --method PATCH \
                -H "Accept: application/vnd.github+json" \
                -H "X-GitHub-Api-Version: 2022-11-28" \
                /repos/$REPO/issues/comments/$COMMENT \
                -F "body=@-" > /dev/null
        fi

        echo "...done"
    fi
fi

[ -n "$GITHUB_OUTPUT" ] && echo "count=${#bundles[@]}" >> $GITHUB_OUTPUT
