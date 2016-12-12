function gql(literals, ...placeholders) {
    // 
}
let x = gql `{sum}`;
let filmInfo = ``;
let filmInfo2 = ``;
x = gql `{
            allFilms {
              films {
                ...${filmInfo}
                ...${filmInfo2}
                ...${1 + 1}
              }
            }
          }`;
