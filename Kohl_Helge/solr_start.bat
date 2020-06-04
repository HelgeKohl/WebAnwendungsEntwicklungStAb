@ECHO off
REM kopiere solrunique.xml zu solr-dir
XCOPY /Y /I /E src\solr\solrunique.xml E:\Programme\solr-8.5.2

REM starte Solr
E:
cd E:\Programme\solr-8.5.2
call bin\solr start

REM indiziere Solr
call java -Dc=epg -jar example/exampledocs/post.jar solrunique.xml

REM warte
PAUSE

REM stoppe Solr
call bin\solr stop -p 8983

REM kopiere Solr-conf zu project-dir
REM XCOPY /Y /I /E E:\Programme\solr-8.5.2\server\solr\epg\conf\schema.xml D:\Dokumente\S6\WAE\Studienarbeit\Abgabeverzeichnisstruktur\Kohl_Helge\src\solr\conf
