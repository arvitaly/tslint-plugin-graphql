function gql(literals: any, ...placeholders: any[]) {
    // 
}
let x = gql`{sum}`;
let filmInfo = ``;
let filmInfo2 = ``;
x = gql`{
            allFilms {
              films {
                ...${ filmInfo}
                ...${filmInfo2}
                ...${1 + 1}
              }
            }
          }`;

