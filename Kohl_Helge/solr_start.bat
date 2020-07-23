@ECHO off
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


