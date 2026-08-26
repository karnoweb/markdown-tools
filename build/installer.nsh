!macro customInstall
  WriteRegStr HKCR "ir.karnoweb.markdown-tools.md" "" "Markdown Tools"
  WriteRegStr HKCR "ir.karnoweb.markdown-tools.markdown" "" "Markdown Tools"
  WriteRegStr HKCR "Applications\${PRODUCT_FILENAME}.exe\FriendlyAppName" "" "Markdown Tools"
!macroend
